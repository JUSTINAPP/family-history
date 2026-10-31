import type { NextRequest } from "next/server";
import { requireSession } from "@/lib/backend/repository";
import { BackendError, safeError } from "@/lib/backend/errors";
import { UUID_PATTERN } from "@/lib/backend/validation";
import { convertPreview } from "@/lib/preview/convert";
import { createHash } from "node:crypto";
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
    .maybeSingle();
  if (error || !original)
    throw new BackendError(404, "Source not found or access is unavailable.");
  const { data: display } = await client
    .from("archive_item_files")
    .select("*")
    .eq("parent_original_id", id)
    .eq("purpose", "display")
    .eq("status", "stored")
    .maybeSingle();
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
    if (!display && ["image/heic", "image/heif"].includes(original.mime_type))
      throw new BackendError(
        409,
        "Preview awaiting preparation. Original preserved.",
      );
    const file = display || original;
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
export async function POST(request: NextRequest, context: Context) {
  try {
    const origin = request.headers.get("origin");
    if (origin && origin !== request.nextUrl.origin)
      throw new BackendError(403, "Open the archive to prepare a preview.");
    const { client, user, original, display } = await source(context);
    if (display) return Response.json({ id: display.id }, { headers });
    const { data: editor } = await client.rpc("can_access_archive", {
      p_archive_id: original.archive_id,
      p_minimum: "editor",
    });
    const { data: contributor } = await client.rpc("can_access_archive", {
      p_archive_id: original.archive_id,
      p_minimum: "contributor",
    });
    if (!editor && !(contributor && original.uploaded_by === user.id))
      throw new BackendError(
        403,
        "A contributor or editor will prepare this preview. Original preserved.",
      );
    const { data: blob, error: downloadError } = await client.storage
      .from(original.bucket_id)
      .download(original.storage_path);
    if (!blob || downloadError)
      throw new BackendError(
        503,
        "The original could not be read. Please retry.",
      );
    const bytes = new Uint8Array(await blob.arrayBuffer());
    const hash = (value: Uint8Array) =>
      createHash("sha256").update(value).digest("hex");
    if (hash(bytes) !== original.sha256)
      throw new BackendError(
        409,
        "Source integrity could not be confirmed. Preview stopped; original unchanged.",
      );
    const preview = await convertPreview(bytes);
    const sha256 = hash(preview.bytes);
    const { data: id, error: reservationError } = await client.rpc(
      "reserve_display",
      {
        p_source_id: original.id,
        p_sha256: sha256,
        p_size: preview.bytes.length,
        p_width: preview.width,
        p_height: preview.height,
      },
    );
    if (reservationError || !id)
      throw new BackendError(
        503,
        "Preview could not be reserved. Check the latest migration, then retry.",
      );
    const { data: reserved } = await client
      .from("archive_item_files")
      .select("*")
      .eq("id", id)
      .single();
    if (!reserved)
      throw new BackendError(
        503,
        "Preview reservation unavailable. Please retry.",
      );
    const { error: uploadError } = await client.storage
      .from(reserved.bucket_id)
      .upload(reserved.storage_path, preview.bytes, {
        contentType: "image/jpeg",
        upsert: false,
        cacheControl: "0",
      });
    if (uploadError) {
      const { data: existing } = await client.storage
        .from(reserved.bucket_id)
        .download(reserved.storage_path);
      if (
        !existing ||
        hash(new Uint8Array(await existing.arrayBuffer())) !== sha256
      )
        throw new BackendError(
          503,
          "Preview upload interrupted. Please retry; the original is safe.",
        );
    }
    const { error } = await client.rpc("complete_display", { p_file_id: id });
    if (error)
      throw new BackendError(503, "Preview receipt pending. Please retry.");
    return Response.json({ id }, { headers });
  } catch (error) {
    return failure(error);
  }
}
