import { requireSession } from "@/lib/backend/repository";
import { BackendError, safeError } from "@/lib/backend/errors";
import { UUID_PATTERN } from "@/lib/backend/validation";
export const runtime = "nodejs";
export async function GET(
  _request: Request,
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
    const { data, error: downloadError } = await client.storage
      .from(file.bucket_id)
      .download(file.storage_path);
    if (downloadError || !data)
      throw new BackendError(404, "The original is currently unavailable.");
    return new Response(data, {
      headers: {
        "Content-Type": file.mime_type,
        "Content-Length": String(data.size),
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
