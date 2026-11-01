import { serverSupabase } from "@/lib/supabase/server";
import { BackendError, safeError } from "@/lib/backend/errors";
import { UUID_PATTERN } from "@/lib/backend/validation";
export const runtime = "nodejs";
export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const headers = {
    "Cache-Control": "private, no-store",
    "X-Content-Type-Options": "nosniff",
  };
  const started = performance.now();
  try {
    const { id } = await params;
    if (!UUID_PATTERN.test(id)) throw new BackendError(404, "Image not found.");
    const client = await serverSupabase();
    const { data: claims, error: authError } = await client.auth.getClaims();
    if (authError || !claims?.claims)
      throw new BackendError(401, "Sign in to view this image.");
    const authenticated = performance.now();
    const { data: file, error } = await client
      .from("archive_item_files")
      .select(
        "bucket_id,storage_path,mime_type,byte_size,width,height,purpose,parent_original_id",
      )
      .eq("id", id)
      .eq("status", "stored")
      .in("purpose", ["display", "thumbnail", "original"])
      .retry(false)
      .abortSignal(AbortSignal.timeout(5000))
      .maybeSingle();
    if (error || !file)
      throw new BackendError(404, "Image not found or access unavailable.");
    if (
      file.purpose === "original" ||
      (file.purpose === "display" &&
        new URL(request.url).searchParams.get("variant") === "thumbnail")
    )
      return new Response(null, {
        status: 307,
        headers: {
          ...headers,
          Location: `/api/v1/previews/${file.parent_original_id || id}?variant=thumbnail`,
        },
      });
    const queried = performance.now();
    const { data: blob, error: storageError } = await client.storage
      .from(file.bucket_id)
      .download(file.storage_path, {}, { signal: AbortSignal.timeout(10000) });
    if (storageError || !blob)
      throw new BackendError(503, "Image temporarily unavailable.");
    const downloaded = performance.now();
    return new Response(blob, {
      headers: {
        ...headers,
        "Content-Type": file.mime_type,
        "Content-Length": String(blob.size),
        "X-Archive-Asset": file.purpose,
        "X-Image-Dimensions": `${file.width}x${file.height}`,
        "Server-Timing": `auth;dur=${(authenticated - started).toFixed(1)}, db;dur=${(queried - authenticated).toFixed(1)}, storage;dur=${(downloaded - queried).toFixed(1)}`,
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
