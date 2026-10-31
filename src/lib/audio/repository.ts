import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { AudioMetadata } from "./validation";
export interface RecordingView {
  id: string;
  archiveId: string;
  itemId: string;
  recollectionId: string;
  fileId: string;
  fileName: string;
  mime: string;
  size: number;
  sha256: string;
  durationMs: number | null;
  contributorId: string;
  contributorName: string;
  createdAt: string;
  updatedAt: string;
  lastEditedBy: string | null;
  archived: boolean;
  standalone: boolean;
  metadata: AudioMetadata;
  people: string[];
  items: string[];
}
export async function loadRecordings(
  client: SupabaseClient,
  archiveId: string,
  itemId?: string,
  recordingId?: string,
): Promise<RecordingView[]> {
  const query = client
    .from("recollection_audio")
    .select("*")
    .eq("archive_id", archiveId)
    .order("created_at")
    .retry(false)
    .abortSignal(AbortSignal.timeout(2500));
  if (recordingId) query.eq("id", recordingId);
  const { data: rows, error } = await query;
  if (error)
    throw new Error(
      "Audio records could not be loaded. Apply migration 006 or retry.",
    );
  if (!rows?.length) return [];
  const [files, people, links, credits] = await Promise.all([
    client
      .from("archive_item_files")
      .select("*")
      .eq("archive_id", archiveId)
      .eq("purpose", "audio_original")
      .eq("status", "stored"),
    client.from("audio_people").select("*").eq("archive_id", archiveId),
    client.from("audio_item_links").select("*").eq("archive_id", archiveId),
    client.rpc("audio_attribution", { p_archive_id: archiveId }),
  ]);
  if (files.error || people.error || links.error || credits.error)
    throw new Error("Audio details are temporarily unavailable.");
  return rows.flatMap((row) => {
    const file = files.data?.find((f) => f.id === row.original_file_id);
    const related = (links.data || [])
      .filter((link) => link.recording_id === row.id)
      .map((link) => link.item_id);
    if (
      !file ||
      (itemId && file.item_id !== itemId && !related.includes(itemId))
    )
      return [];
    return [
      {
        id: row.id,
        archiveId: row.archive_id,
        itemId: file.item_id,
        recollectionId: row.recollection_id,
        fileId: file.id,
        fileName: file.original_filename,
        mime: file.mime_type,
        size: Number(file.byte_size),
        sha256: file.sha256,
        durationMs: row.duration_ms,
        contributorId: row.contributed_by,
        contributorName:
          (
            (credits.data || []) as {
              recording_id: string;
              display_name: string;
            }[]
          ).find((credit) => credit.recording_id === row.id)?.display_name ||
          "Archive contributor",
        createdAt: row.created_at,
        updatedAt: row.updated_at,
        lastEditedBy: row.last_edited_by,
        archived: !!row.archived_at,
        standalone: row.standalone,
        metadata: {
          title: row.title,
          speaker: row.speaker_text,
          speakerPersonId: row.speaker_person_id || "",
          recordedDate: row.recorded_date,
          precision: row.date_precision,
          location: row.location,
          description: row.description,
          tags: row.tags,
        },
        people: (people.data || [])
          .filter((p) => p.recording_id === row.id)
          .map((p) => p.person_id),
        items: related,
      },
    ];
  });
}
