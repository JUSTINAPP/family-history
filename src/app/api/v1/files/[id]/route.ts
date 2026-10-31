import { audioRange } from "@/lib/audio/range";
import { requireSession } from "@/lib/backend/repository";
import { BackendError, safeError } from "@/lib/backend/errors";
import { UUID_PATTERN } from "@/lib/backend/validation";
export const runtime = "nodejs";
export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    if (!UUID_PATTERN.test(id)) throw new BackendError(404, "File not found.");
    const { client } = await requireSession();
    const { data: file, error } = await client
      .from("archive_item_files")
      .select("bucket_id,storage_path,mime_type,original_filename")
      .eq("id", id)
      .eq("status", "stored")
      .maybeSingle();
    if (error || !file)
      throw new BackendError(
        404,
        "File not found, or access is no longer available.",
      );
    if (file.mime_type.startsWith("audio/")) {
      const { data: signed, error: signingError } = await client.storage
        .from(file.bucket_id)
        .createSignedUrl(
          file.storage_path,
          600,
          new URL(request.url).searchParams.has("download")
            ? { download: file.original_filename }
            : undefined,
        );
      if (signingError || !signed)
        throw new BackendError(
          404,
          "The original audio is currently unavailable.",
        );
      return new Response(null, {
        status: 307,
        headers: {
          Location: signed.signedUrl,
          "Cache-Control": "private, no-store",
          "Referrer-Policy": "no-referrer",
        },
      });
    }
    const { data, error: downloadError } = await client.storage
      .from(file.bucket_id)
      .download(file.storage_path);
    if (downloadError || !data)
      throw new BackendError(404, "The original is currently unavailable.");
    const range = audioRange(request.headers.get("range"), data.size);
    if (range === false)
      return new Response(null, {
        status: 416,
        headers: {
          "Content-Range": `bytes */${data.size}`,
          "Cache-Control": "private, no-store",
        },
      });
    const body = range
      ? data.slice(range.start, range.end + 1, file.mime_type)
      : data;
    return new Response(body, {
      status: range ? 206 : 200,
      headers: {
        "Content-Type": file.mime_type,
        "Content-Length": String(body.size),
        "Accept-Ranges": "bytes",
        ...(range
          ? {
              "Content-Range": `bytes ${range.start}-${range.end}/${data.size}`,
            }
          : {}),
        "Content-Disposition": "inline",
        "Cache-Control": "private, no-store",
        "X-Content-Type-Options": "nosniff",
        "Content-Security-Policy": "default-src 'none'; sandbox",
      },
    });
  } catch (error) {
    const safe = safeError(error);
    return Response.json(
      { error: safe.message },
      { status: safe.status, headers: { "Cache-Control": "no-store" } },
    );
  }
}
