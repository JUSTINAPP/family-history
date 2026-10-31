"use server";
import { requireSession } from "../backend/repository";
import { safeError } from "../backend/errors";
import { revalidatePath } from "next/cache";
import type { AudioMetadata } from "./validation";
export async function editAudioAction(
  id: string,
  metadata: AudioMetadata,
  people: string[],
  items: string[],
) {
  try {
    const { client } = await requireSession();
    const { error } = await client.rpc("edit_audio_recording", {
      p_recording_id: id,
      p_metadata: metadata,
      p_people: people,
      p_items: items,
    });
    if (error)
      return "Audio details could not be saved. Check your access and the selected links.";
    revalidatePath("/", "layout");
    return null;
  } catch (error) {
    return safeError(error).message;
  }
}
export async function archiveAudioAction(id: string, archived: boolean) {
  try {
    const { client } = await requireSession();
    const { error } = await client.rpc("archive_audio_recording", {
      p_recording_id: id,
      p_archived: archived,
    });
    if (error) return "Editor access is required to change the archive state.";
    revalidatePath("/", "layout");
    return null;
  } catch (error) {
    return safeError(error).message;
  }
}
