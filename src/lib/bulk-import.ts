import type { SupabaseClient } from "@supabase/supabase-js";
import { persistUpload } from "./backend/upload-core";
export interface ImportEntry {
  captureId: string;
  file: File;
  status: "pending" | "uploading" | "saved" | "failed";
  itemId?: string;
  error?: string;
  previewUrl?: string;
}
export async function importPhotographs(
  client: SupabaseClient,
  entries: ImportEntry[],
  archiveId: string,
  context: string,
  changed: (entry: ImportEntry) => void,
  ingest = persistUpload,
) {
  for (const entry of entries) {
    if (entry.status === "saved") continue;
    changed({ ...entry, status: "uploading", error: undefined });
    const form = new FormData();
    form.set("archiveId", archiveId);
    form.set("captureId", entry.captureId);
    form.set("kind", "Photograph");
    form.set(
      "title",
      entry.file.name.replace(/\.[^.]+$/, "").slice(0, 300) ||
        "Imported photograph",
    );
    form.set("context", context);
    form.set("quick", '{"precision":"unknown"}');
    form.set("roles", '["image"]');
    form.append("files", entry.file, entry.file.name);
    try {
      const result = await ingest(client, form);
      changed({
        ...entry,
        status: "saved",
        itemId: result.id,
        error: undefined,
      });
    } catch (error) {
      changed({
        ...entry,
        status: "failed",
        error:
          error instanceof Error
            ? error.message
            : "Import interrupted. Retry with the same original.",
      });
    }
  }
}
