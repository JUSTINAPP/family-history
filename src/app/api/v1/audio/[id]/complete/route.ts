import type { NextRequest } from "next/server";
import { requireSession } from "@/lib/backend/repository";
import { BackendError, safeError } from "@/lib/backend/errors";
import { UUID_PATTERN } from "@/lib/backend/validation";
import { audioChecksum } from "@/lib/audio/validation";
import { inspectAudio } from "@/lib/audio/server-validation";
export const runtime = "nodejs";
export const maxDuration = 60;
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const headers = { "Cache-Control": "private, no-store" };
  try {
    if (
      request.headers.get("origin") &&
      request.headers.get("origin") !== request.nextUrl.origin
    )
      throw new BackendError(403, "Save audio from the archive application.");
    const { client, user } = await requireSession();
    const { id } = await params;
    if (!UUID_PATTERN.test(id))
      throw new BackendError(404, "Recording not found.");
    const { data: recording } = await client
      .from("recollection_audio")
      .select("*")
      .eq("id", id)
      .maybeSingle();
    if (!recording || recording.contributed_by !== user.id)
      throw new BackendError(
        403,
        "This recording cannot be saved by your account.",
      );
    const { data: allowed } = await client.rpc("can_access_archive", {
      p_archive_id: recording.archive_id,
      p_minimum: "contributor",
    });
    if (!allowed)
      throw new BackendError(403, "Contributor access is required.");
    const { data: file } = await client
      .from("archive_item_files")
      .select("*")
      .eq("id", recording.original_file_id)
      .single();
    if (!file) throw new BackendError(404, "Original audio not found.");
    const { data: blob } = await client.storage
      .from(file.bucket_id)
      .download(file.storage_path);
    if (!blob)
      throw new BackendError(
        503,
        "Audio receipt is incomplete. Keep this page open and retry.",
      );
    const bytes = new Uint8Array(await blob.arrayBuffer());
    if (
      bytes.length !== Number(file.byte_size) ||
      (await audioChecksum(bytes)) !== file.sha256
    )
      throw new BackendError(
        409,
        "Audio integrity could not be confirmed. Original unchanged.",
      );
    const duration = await inspectAudio(bytes, file.mime_type);
    const { data: itemId, error } = await client.rpc(
      "complete_audio_recording",
      { p_recording_id: id, p_duration_ms: duration },
    );
    if (error)
      throw new BackendError(
        503,
        "Audio confirmation could not finish. Please retry.",
      );
    return Response.json({ itemId }, { headers });
  } catch (error) {
    const safe = safeError(error);
    return Response.json(
      { error: safe.message },
      { status: safe.status, headers },
    );
  }
}
