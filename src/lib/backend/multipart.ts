import { BackendError } from "./errors";

export const MAX_UPLOAD_REQUEST_BYTES = 90 * 1024 * 1024;

/** Bound the transport even when a client omits Content-Length. */
export async function readUploadForm(request: Request): Promise<FormData> {
  const type = request.headers.get("content-type") || "";
  if (!type.toLowerCase().startsWith("multipart/form-data;"))
    throw new BackendError(400, "Choose files using the capture form.");
  if (Number(request.headers.get("content-length")) > MAX_UPLOAD_REQUEST_BYTES)
    throw new BackendError(413, "Keep each capture below 80 MB.");
  if (!request.body) throw new BackendError(400, "Choose a file to upload.");
  const reader = request.body.getReader();
  const chunks: Uint8Array<ArrayBuffer>[] = [];
  let size = 0;
  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > MAX_UPLOAD_REQUEST_BYTES) {
        await reader.cancel();
        throw new BackendError(413, "Keep each capture below 80 MB.");
      }
      chunks.push(value);
    }
    return await new Response(new Blob(chunks), {
      headers: { "Content-Type": type },
    }).formData();
  } catch (error) {
    if (error instanceof BackendError) throw error;
    throw new BackendError(400, "The upload was interrupted. Please try again.");
  } finally {
    reader.releaseLock();
  }
}
