import type { SupabaseClient } from "@supabase/supabase-js";
export interface BatchSource {
  captureId: string;
  itemId: string;
  status: "saved" | "failed";
  fileName: string;
  size: number;
  sha256: string;
}
export interface BatchSnapshot {
  id: string;
  archiveId: string;
  context: string;
  expectedCount: number;
  createdBy: string;
  sources: BatchSource[];
}
export async function readImportBatch(
  client: SupabaseClient,
  id: string,
): Promise<BatchSnapshot | null> {
  const { data: batch, error } = await client
    .from("import_batches")
    .select("*")
    .eq("id", id)
    .maybeSingle();
  if (error)
    throw new Error(
      "Import batches could not be loaded. Apply migration 007 or retry.",
    );
  if (!batch) return null;
  const { data: links, error: linkError } = await client
    .from("import_batch_items")
    .select("item_id")
    .eq("batch_id", id)
    .order("created_at")
    .order("item_id");
  if (linkError) throw new Error("Import progress could not be loaded.");
  const sources: BatchSource[] = [];
  const ids = (links || []).map((link) => link.item_id);
  // Keep request URLs bounded and include every source in a 500-photo batch.
  for (let start = 0; start < ids.length; start += 100) {
    const selected = ids.slice(start, start + 100);
    const [items, files] = await Promise.all([
      client
        .from("archive_items")
        .select("id,client_capture_id,ingestion_status")
        .in("id", selected),
      client
        .from("archive_item_files")
        .select("item_id,original_filename,byte_size,sha256,status")
        .in("item_id", selected)
        .eq("purpose", "original"),
    ]);
    if (items.error || files.error)
      throw new Error("Some import receipts could not be loaded.");
    for (const item of items.data || []) {
      const file = files.data?.find((f) => f.item_id === item.id);
      if (file)
        sources.push({
          captureId: item.client_capture_id,
          itemId: item.id,
          status:
            item.ingestion_status === "ready" && file.status === "stored"
              ? "saved"
              : "failed",
          fileName: file.original_filename,
          size: Number(file.byte_size),
          sha256: file.sha256,
        });
    }
  }
  return {
    id: batch.id,
    archiveId: batch.archive_id,
    context: batch.context,
    expectedCount: batch.expected_count,
    createdBy: batch.created_by,
    sources,
  };
}
