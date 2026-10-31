import type { NextRequest } from "next/server";
import { requireSession } from "@/lib/backend/repository";
import { BackendError, safeError } from "@/lib/backend/errors";
import { UUID_PATTERN } from "@/lib/backend/validation";
import { convertPreview, PreviewConversionError } from "@/lib/preview/convert";
import { isSameOriginRequest } from "@/lib/backend/request-origin";
import { createHash, randomUUID } from "node:crypto";
export const runtime = "nodejs";
export const maxDuration = 60;
const headers = { "Cache-Control": "private, no-store" };
type Context = { params: Promise<{ id: string }> };
async function source(context: Context) {
  const { client, user } = await requireSession();
  const { id } = await context.params;
  if (!UUID_PATTERN.test(id)) throw new BackendError(404, "Source not found.");
  const { data: original, error } = await client
    .from("archive_item_files")
    .select("*")
    .eq("id", id)
    .eq("purpose", "original")
    .eq("status", "stored")
    .retry(false)
    .abortSignal(AbortSignal.timeout(5000))
    .maybeSingle();
  if (error || !original)
    throw new BackendError(404, "Source not found or access is unavailable.");
  const { data: display, error: displayError } = await client
    .from("archive_item_files")
    .select("*")
    .eq("parent_original_id", id)
    .eq("purpose", "display")
    .retry(false)
    .abortSignal(AbortSignal.timeout(5000))
    .maybeSingle();
  if (displayError)
    throw new BackendError(
      503,
      "Preview records could not be read. Please retry.",
    );
  return { client, user, original, display };
}
function failure(error: unknown) {
  const safe = safeError(error);
  return Response.json(
    { error: safe.message },
    { status: safe.status, headers },
  );
}
export async function GET(_request: Request, context: Context) {
  try {
    const { client, original, display } = await source(context);
    if (
      display?.status !== "stored" &&
      ["image/heic", "image/heif"].includes(original.mime_type)
    )
      throw new BackendError(
        409,
        "Preview awaiting preparation. Original preserved.",
      );
    const file = display?.status === "stored" ? display : original;
    const { data, error } = await client.storage
      .from(file.bucket_id)
      .download(file.storage_path);
    if (!data || error)
      throw new BackendError(
        503,
        "Preview temporarily unavailable. Please retry.",
      );
    return new Response(data, {
      headers: {
        ...headers,
        "Content-Type": file.mime_type,
        "X-Content-Type-Options": "nosniff",
        "Content-Security-Policy": "default-src 'none'; sandbox",
      },
    });
  } catch (error) {
    return failure(error);
  }
}
type Stage =
  "download" | "integrity" | "decode" | "reserve" | "upload" | "complete";
class PreviewError extends BackendError {
  constructor(
    public code: string,
    message: string,
    status = 503,
  ) {
    super(status, message);
  }
}
const hash = (value: Uint8Array) =>
  createHash("sha256").update(value).digest("hex");
export async function POST(request: NextRequest, context: Context) {
  const requestId = randomUUID();
  const deadline = Date.now() + 50000; // Leave time to persist failure before Vercel's 60s limit.
  function remaining(maximum: number) {
    const left = deadline - Date.now();
    if (left <= 0)
      throw new PreviewError(
        "processing_timeout",
        "Preview processing timed out. Original preserved; retry is available.",
      );
    return Math.min(maximum, left);
  }
  async function bounded<T>(task: PromiseLike<T>): Promise<T> {
    let timer: ReturnType<typeof setTimeout> | undefined;
    try {
      return await Promise.race([
        task,
        new Promise<never>((_, reject) => {
          timer = setTimeout(
            () =>
              reject(
                new PreviewError(
                  "processing_timeout",
                  "Preview upload timed out. Retry to recover its receipt.",
                ),
              ),
            remaining(10000),
          );
        }),
      ]);
    } finally {
      clearTimeout(timer);
    }
  }
  let stage: Stage = "download";
  let attemptId: string | undefined;
  let loaded: Awaited<ReturnType<typeof source>> | undefined;
  async function record(errorCode?: string) {
    if (!attemptId || !loaded) return;
    const { error } = await loaded.client
      .rpc("record_preview_attempt", {
        p_source_id: loaded.original.id,
        p_attempt_id: attemptId,
        p_stage: stage,
        p_error_code: errorCode || null,
      })
      .retry(false)
      .abortSignal(AbortSignal.timeout(3000));
    if (error)
      console.error(
        JSON.stringify({
          event: "preview_state_unavailable",
          requestId,
          stage,
          code: error.code,
        }),
      );
  }
  try {
    if (!isSameOriginRequest(request))
      throw new PreviewError(
        "origin_rejected",
        "Open the archive to prepare a preview.",
        403,
      );
    loaded = await source(context);
    const { client, original, display } = loaded;
    if (display?.status === "stored")
      return Response.json({ id: display.id }, { headers });
    // The database checks Editor or the contributing item's Contributor, scoped to this source's archive.
    const { data: lease, error: leaseError } = await client
      .rpc("begin_preview_attempt", {
        p_source_id: original.id,
      })
      .retry(false)
      .abortSignal(AbortSignal.timeout(remaining(5000)));
    if (leaseError || !lease) {
      if (leaseError?.code === "55P03")
        throw new PreviewError(
          "preview_busy",
          "This preview is already being prepared. Retry shortly.",
          429,
        );
      if (leaseError?.code === "42501")
        throw new PreviewError(
          "permission_denied",
          "An editor or the item's contributor can prepare this preview.",
          403,
        );
      throw new PreviewError(
        "preview_schema_unavailable",
        "Preview processing is unavailable. An administrator should check migration 008 and the function logs.",
      );
    }
    attemptId = lease;
    // Recover an uploaded-but-unacknowledged derivative without decoding or overwriting it.
    if (display?.status === "reserved") {
      const { data: previous } = await client.storage
        .from(display.bucket_id)
        .download(
          display.storage_path,
          {},
          { signal: AbortSignal.timeout(remaining(5000)) },
        );
      if (previous) {
        const bytes = new Uint8Array(await previous.arrayBuffer());
        if (
          bytes.length !== Number(display.byte_size) ||
          hash(bytes) !== display.sha256
        )
          throw new PreviewError(
            "reserved_display_integrity",
            "The reserved preview could not be verified. Original preserved; contact an administrator.",
            409,
          );
        stage = "complete";
        const { error } = await client
          .rpc("complete_display", { p_file_id: display.id })
          .retry(false);
        if (error)
          throw new PreviewError(
            "receipt_failed",
            "Preview receipt pending. Retry to recover it.",
          );
        await record();
        return Response.json({ id: display.id, requestId }, { headers });
      }
    }
    if (Number(original.byte_size) > 30 * 1024 * 1024)
      throw new PreviewError(
        "source_size_limit",
        "This original exceeds the 30 MB preview limit. It remains preserved.",
        422,
      );
    const { data: blob, error: downloadError } = await client.storage
      .from(original.bucket_id)
      .download(
        original.storage_path,
        {},
        { signal: AbortSignal.timeout(remaining(10000)) },
      );
    if (!blob || downloadError)
      throw new PreviewError(
        "source_download_failed",
        "The original could not be read. Retry when connected.",
      );
    stage = "integrity";
    const bytes = new Uint8Array(await blob.arrayBuffer());
    if (
      bytes.length !== Number(original.byte_size) ||
      hash(bytes) !== original.sha256
    )
      throw new PreviewError(
        "source_integrity_failed",
        "Source integrity could not be confirmed. Preview stopped; original unchanged.",
        409,
      );
    stage = "decode";
    await record();
    const decodeBudget = remaining(50000) - 15000;
    if (decodeBudget <= 0)
      throw new PreviewError(
        "processing_timeout",
        "Preview processing timed out. Original preserved; retry is available.",
      );
    const preview = await convertPreview(bytes, decodeBudget);
    const sha256 = hash(preview.bytes);
    stage = "reserve";
    const { data: id, error: reservationError } = await client
      .rpc("reserve_display", {
        p_source_id: original.id,
        p_sha256: sha256,
        p_size: preview.bytes.length,
        p_width: preview.width,
        p_height: preview.height,
      })
      .retry(false)
      .abortSignal(AbortSignal.timeout(remaining(5000)));
    if (reservationError || !id)
      throw new PreviewError(
        "reservation_failed",
        "Preview could not be reserved. Original preserved; retry is available.",
      );
    const { data: reserved, error: reservedError } = await client
      .from("archive_item_files")
      .select("*")
      .eq("id", id)
      .retry(false)
      .abortSignal(AbortSignal.timeout(remaining(5000)))
      .single();
    if (reservedError || !reserved)
      throw new PreviewError(
        "reservation_lookup_failed",
        "Preview reservation unavailable. Please retry.",
      );
    stage = "upload";
    const { error: uploadError } = await bounded(
      client.storage
        .from(reserved.bucket_id)
        .upload(reserved.storage_path, preview.bytes, {
          contentType: "image/jpeg",
          upsert: false,
          cacheControl: "0",
        }),
    );
    if (uploadError) {
      const { data: existing } = await client.storage
        .from(reserved.bucket_id)
        .download(
          reserved.storage_path,
          {},
          { signal: AbortSignal.timeout(remaining(5000)) },
        );
      if (
        !existing ||
        hash(new Uint8Array(await existing.arrayBuffer())) !== sha256
      )
        throw new PreviewError(
          "display_upload_failed",
          "Preview upload interrupted. Retry; the original is safe.",
        );
    }
    stage = "complete";
    const { error } = await client
      .rpc("complete_display", { p_file_id: id })
      .retry(false)
      .abortSignal(AbortSignal.timeout(remaining(5000)));
    if (error)
      throw new PreviewError(
        "receipt_failed",
        "Preview receipt pending. Retry to recover it.",
      );
    await record();
    console.info(
      JSON.stringify({
        event: "preview_complete",
        requestId,
        sourceId: original.id,
        stage,
      }),
    );
    return Response.json({ id, requestId }, { headers });
  } catch (error) {
    const code =
      error instanceof PreviewError || error instanceof PreviewConversionError
        ? error.code
        : "preview_request_failed";
    await record(code).catch(() => {});
    console.error(
      JSON.stringify({
        event: "preview_failed",
        requestId,
        sourceId: loaded?.original.id,
        stage,
        code,
      }),
    );
    const safe = safeError(error);
    return Response.json(
      {
        error: `${safe.message} Reference: ${requestId}`,
        code,
        stage,
        requestId,
      },
      { status: safe.status, headers },
    );
  }
}
