import type { NextRequest } from "next/server";
import { requireSession } from "@/lib/backend/repository";
import { BackendError, safeError } from "@/lib/backend/errors";
import { UUID_PATTERN } from "@/lib/backend/validation";
import { convertPreview, PreviewConversionError } from "@/lib/preview/convert";
import { isSameOriginRequest } from "@/lib/backend/request-origin";
import { imageSet, type ImageSetRow } from "@/lib/preview/types";
import { createHash, randomUUID } from "node:crypto";
export const runtime = "nodejs";
export const maxDuration = 60;
const headers = { "Cache-Control": "private, no-store" };
type Context = { params: Promise<{ id: string }> };
class PreviewError extends BackendError {
  constructor(
    public code: string,
    message: string,
    status = 503,
  ) {
    super(status, message);
  }
}
const hash = (bytes: Uint8Array) =>
  createHash("sha256").update(bytes).digest("hex");
async function source(context: Context) {
  const { client } = await requireSession();
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
  return { client, original };
}
export async function GET(request: Request, context: Context) {
  try {
    const { client, original } = await source(context);
    const variant =
      new URL(request.url).searchParams.get("variant") || "display";
    if (!["display", "thumbnail", "small"].includes(variant))
      throw new BackendError(400, "Unknown image size.");
    const { data: set, error } = await client
      .from("image_sets")
      .select("*")
      .eq("original_file_id", original.id)
      .eq("status", "stored")
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (error)
      throw new BackendError(
        503,
        "Image derivatives could not load. Check migration 009.",
      );
    let file;
    if (set) {
      const key =
        variant === "display"
          ? "display_file_id"
          : variant === "thumbnail"
            ? "thumbnail_file_id"
            : "small_file_id";
      const result = await client
        .from("archive_item_files")
        .select("*")
        .eq("id", set[key])
        .eq("status", "stored")
        .maybeSingle();
      file = result.data;
    } else if (variant === "display") {
      const result = await client
        .from("archive_item_files")
        .select("*")
        .eq("parent_original_id", original.id)
        .eq("purpose", "display")
        .eq("status", "stored")
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      file = result.data;
    }
    if (!file)
      throw new BackendError(
        409,
        "Browser derivative awaiting preparation. Original preserved.",
      );
    const { data, error: storageError } = await client.storage
      .from(file.bucket_id)
      .download(file.storage_path, {}, { signal: AbortSignal.timeout(10000) });
    if (!data || storageError)
      throw new BackendError(
        503,
        "Preview temporarily unavailable. Please retry.",
      );
    return new Response(data, {
      headers: {
        ...headers,
        "Content-Type": file.mime_type,
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch (error) {
    const safe = safeError(error);
    return Response.json(
      { error: safe.message },
      { status: safe.status, headers },
    );
  }
}
export async function POST(request: NextRequest, context: Context) {
  const requestId = randomUUID(),
    deadline = Date.now() + 50000;
  let stage = "download",
    attemptId: string | undefined,
    loaded: Awaited<ReturnType<typeof source>> | undefined;
  function remaining(max: number) {
    const left = deadline - Date.now();
    if (left <= 0)
      throw new PreviewError(
        "processing_timeout",
        "Preview processing timed out. Original preserved; retry is available.",
      );
    return Math.min(max, left);
  }
  async function record(code?: string) {
    if (!attemptId || !loaded) return;
    const { error } = await loaded.client
      .rpc("record_preview_attempt", {
        p_source_id: loaded.original.id,
        p_attempt_id: attemptId,
        p_stage: stage,
        p_error_code: code || null,
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
  try {
    if (!isSameOriginRequest(request))
      throw new PreviewError(
        "origin_rejected",
        "Open the archive to prepare a preview.",
        403,
      );
    loaded = await source(context);
    const { client, original } = loaded;
    const regenerate = request.nextUrl.searchParams.get("regenerate") === "1";
    if (regenerate) {
      const { data } = await client.rpc("can_access_archive", {
        p_archive_id: original.archive_id,
        p_minimum: "editor",
      });
      if (!data)
        throw new PreviewError(
          "permission_denied",
          "Editor access is required to regenerate images.",
          403,
        );
    }
    const { data: existing, error: lookupError } = await client
      .from("image_sets")
      .select("*")
      .eq("original_file_id", original.id)
      .eq("status", "stored")
      .eq("generator", "responsive-v1")
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (lookupError)
      throw new PreviewError(
        "preview_schema_unavailable",
        "Image processing is unavailable. Check migration 009.",
      );
    if (existing && !regenerate)
      return Response.json(
        {
          id: existing.display_file_id,
          imageSet: imageSet({...existing,presentation_rotation:original.presentation_rotation} as ImageSetRow),
        },
        { headers },
      );
    const { data: lease, error: leaseError } = await client
      .rpc("begin_preview_attempt", { p_source_id: original.id })
      .retry(false)
      .abortSignal(AbortSignal.timeout(remaining(5000)));
    if (leaseError || !lease)
      throw new PreviewError(
        leaseError?.code === "55P03" ? "preview_busy" : "permission_denied",
        leaseError?.code === "55P03"
          ? "Preview already processing. Retry shortly."
          : "An editor or the item's contributor can prepare this preview.",
        leaseError?.code === "55P03" ? 429 : 403,
      );
    attemptId = lease;
    if (Number(original.byte_size) > 30 * 1024 * 1024)
      throw new PreviewError(
        "source_size_limit",
        "Original exceeds the preview size limit; it remains preserved.",
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
        "Source integrity could not be confirmed. Original unchanged.",
        409,
      );
    stage = "decode";
    await record();
    const budget = remaining(50000) - 15000;
    if (budget <= 0)
      throw new PreviewError(
        "processing_timeout",
        "Not enough processing time remains; retry is available.",
      );
    const rendered = await convertPreview(bytes, budget);
    const variants = {
      display: {
        bytes: rendered.bytes,
        width: rendered.width,
        height: rendered.height,
        mime: "image/jpeg",
      },
      thumbnail: { ...rendered.thumbnail, mime: "image/webp" },
      small: { ...rendered.small, mime: "image/webp" },
    };
    const manifest = Object.fromEntries(
      Object.entries(variants).map(([key, v]) => [
        key,
        {
          width: v.width,
          height: v.height,
          size: v.bytes.length,
          sha256: hash(v.bytes),
          mime: v.mime,
        },
      ]),
    );
    stage = "reserve";
    await record();
    const { data: setId, error: reserveError } = await client
      .rpc("reserve_image_set", {
        p_source_id: original.id,
        p_manifest: manifest,
        p_placeholder: rendered.placeholder,
      })
      .retry(false)
      .abortSignal(AbortSignal.timeout(remaining(5000)));
    if (reserveError || !setId)
      throw new PreviewError(
        "reservation_failed",
        "Image set could not be reserved. Original preserved.",
      );
    const { data: set } = await client
      .from("image_sets")
      .select("*")
      .eq("id", setId)
      .single();
    if (!set)
      throw new PreviewError(
        "reservation_lookup_failed",
        "Reserved image set unavailable. Retry is available.",
      );
    const ids = [set.display_file_id, set.thumbnail_file_id, set.small_file_id];
    const { data: files } = await client
      .from("archive_item_files")
      .select("*")
      .in("id", ids);
    if (files?.length !== 3)
      throw new PreviewError(
        "reservation_lookup_failed",
        "Image receipts incomplete. Retry is available.",
      );
    stage = "upload";
    await record();
    for (const [key, v] of Object.entries(variants)) {
      const id =
        key === "display"
          ? set.display_file_id
          : key === "thumbnail"
            ? set.thumbnail_file_id
            : set.small_file_id;
      const file = files.find((f) => f.id === id)!;
      const { error } = await bounded(
        client.storage
          .from(file.bucket_id)
          .upload(file.storage_path, v.bytes, {
            contentType: v.mime,
            upsert: false,
            cacheControl: "0",
          }),
      );
      if (error) {
        const { data: prior } = await client.storage
          .from(file.bucket_id)
          .download(
            file.storage_path,
            {},
            { signal: AbortSignal.timeout(remaining(5000)) },
          );
        if (
          !prior ||
          hash(new Uint8Array(await prior.arrayBuffer())) !==
            manifest[key].sha256
        )
          throw new PreviewError(
            "display_upload_failed",
            "Image upload interrupted. Original safe; retry can recover it.",
          );
      }
    }
    stage = "complete";
    await record();
    const { error: completeError } = await client
      .rpc("complete_image_set", { p_set_id: set.id })
      .retry(false)
      .abortSignal(AbortSignal.timeout(remaining(5000)));
    if (completeError)
      throw new PreviewError(
        "receipt_failed",
        "Image receipt pending. Retry to recover it.",
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
    return Response.json(
      {
        id: set.display_file_id,
        imageSet: imageSet({...set,presentation_rotation:original.presentation_rotation} as ImageSetRow),
        requestId,
      },
      { headers },
    );
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
