import type { SupabaseClient } from "@supabase/supabase-js";
import { persistUpload } from "./backend/upload-core";
export interface ImportEntry {
  captureId: string;
  file: File;
  status: "pending" | "uploading" | "saved" | "failed";
  itemId?: string;
  error?: string;
  previewUrl?: string;
  needsFile?: boolean;
}
export async function importPhotographs(
  client: SupabaseClient,
  entries: ImportEntry[],
  archiveId: string,
  context: string,
  changed: (entry: ImportEntry) => void,
  ingest = persistUpload,
  batchId?: string,
) {
  void context; // Stored once by create_import_batch; never copied into item recollections.
  for (const entry of entries) {
    if (entry.status === "saved") continue;
    if (entry.needsFile || !entry.file.size) {
      changed({
        ...entry,
        status: "failed",
        error: "Choose this original file again to resume.",
      });
      continue;
    }
    changed({ ...entry, status: "uploading", error: undefined });
    const form = new FormData();
    form.set("archiveId", archiveId);
    form.set("captureId", entry.captureId);
    form.set("kind", "Photograph");
    form.set("title", "Photograph, still to be catalogued");
    // Batch context belongs to import_batches, never to individual metadata/recollections.
    form.set("context", "");
    if (batchId) form.set("batchId", batchId);
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
