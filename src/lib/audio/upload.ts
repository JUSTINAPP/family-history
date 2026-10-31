import type { SupabaseClient } from "@supabase/supabase-js";
import {
  MAX_AUDIO_BYTES,
  audioChecksum,
  validateAudioBytes,
  type AudioMetadata,
} from "./validation";
import { BackendError } from "../backend/errors";
import { UUID_PATTERN } from "../backend/validation";
export async function uploadAudio(
  client: SupabaseClient,
  input: {
    archiveId: string;
    captureId: string;
    itemId?: string;
    file: File;
    metadata: AudioMetadata;
    people: string[];
    items: string[];
  },
  finalise: (id: string) => Promise<{ itemId: string }> = async (id) => {
    const response = await fetch(`/api/v1/audio/${id}/complete`, {
      method: "POST",
    });
    const result = await response
      .json()
      .catch(() => ({
        error: "Audio confirmation interrupted. Retry with the same original.",
      }));
    if (!response.ok)
      throw new BackendError(
        response.status,
        result.error || "Audio could not be confirmed. Please retry.",
      );
    return result;
  },
) {
  if (
    ![
      input.archiveId,
      input.captureId,
      ...(input.itemId ? [input.itemId] : []),
      ...input.people,
      ...input.items,
    ].every((id) => UUID_PATTERN.test(id))
  )
    throw new BackendError(400, "Choose an archive and try again.");
  if (!input.file.size || input.file.size > MAX_AUDIO_BYTES)
    throw new BackendError(400, "Choose an audio file up to 30 MB.");
  const bytes = new Uint8Array(await input.file.arrayBuffer());
  const mimeType = validateAudioBytes(bytes, input.file.type);
  const sha256 = await audioChecksum(bytes);
  const { data: id, error } = await client.rpc("begin_audio_recording", {
    p_archive_id: input.archiveId,
    p_capture_id: input.captureId,
    p_item_id: input.itemId || null,
    p_file: {
      name: input.file.name.slice(0, 255),
      size: bytes.length,
      mimeType,
      sha256,
      originalMime: input.file.type,
      durationMs: input.metadata.durationMs || null,
    },
    p_metadata: input.metadata,
    p_people: input.people,
    p_items: input.items,
  });
  if (error || !id)
    throw new BackendError(
      error?.code === "42501" ? 403 : 503,
      "Audio could not be prepared. Check Contributor access and migration 006, then retry.",
    );
  const { data: recording } = await client
    .from("recollection_audio")
    .select("original_file_id")
    .eq("id", id)
    .single();
  const { data: file } = await client
    .from("archive_item_files")
    .select("*")
    .eq("id", recording?.original_file_id || "")
    .single();
  if (
    !file ||
    file.sha256 !== sha256 ||
    Number(file.byte_size) !== bytes.length ||
    file.mime_type !== mimeType
  )
    throw new BackendError(
      409,
      "This retry has different audio. Start a new recording; preserved originals will not be replaced.",
    );
  if (file.status !== "stored") {
    const { error: uploadError } = await client.storage
      .from(file.bucket_id)
      .upload(file.storage_path, bytes, {
        contentType: mimeType,
        upsert: false,
        cacheControl: "0",
      });
    if (uploadError) {
      const { data: existing } = await client.storage
        .from(file.bucket_id)
        .download(file.storage_path);
      if (
        !existing ||
        (await audioChecksum(new Uint8Array(await existing.arrayBuffer()))) !==
          sha256
      )
        throw new BackendError(
          503,
          "Audio upload interrupted. Keep this page open and retry with the same original.",
        );
    }
  }
  return { recordingId: id, ...(await finalise(id)) };
}
