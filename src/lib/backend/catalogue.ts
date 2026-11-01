import { cataloguePresentation } from "../catalogue-presentation";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { ArchiveItem } from "../types";
import { BackendError } from "./errors";
import { imageSet, type ImageSetRow } from "../preview/types";
export interface CatalogueRow {
  id: string;
  archive_id: string;
  title: string | null;
  kind: ArchiveItem["kind"] | null;
  reported_date: string | null;
  date_precision?: string;
  reported_place: string | null;
  people_text: string | null;
  catalogued_at: string | null;
  evidence_status: ArchiveItem["certainty"];
  notes: string | null;
  ingestion_status: string;
  archived_at?: string | null;
  contributed_by?: string;
  created_at?: string;
  updated_at?: string;
}
export interface OriginalRow {
  id: string;
  item_id: string;
  purpose: string;
  status: string;
  page_order?: number;
}
export async function allRows<T>(
  page: (
    from: number,
    to: number,
  ) => PromiseLike<{ data: T[] | null; error: unknown; count?: number | null }>,
  key: (row: T) => string,
): Promise<{ data: T[]; count: number }> {
  const rows = new Map<string, T>();
  let offset = 0,
    expected: number | null = null;
  for (;;) {
    const result = await page(offset, offset + 199);
    if (result.error)
      throw new BackendError(
        503,
        "The archive list could not be loaded. Please retry.",
      );
    if (result.count != null) expected = result.count;
    const values = result.data || [];
    if (!values.length) break;
    const previous = rows.size;
    values.forEach((row) => rows.set(key(row), row));
    if (rows.size === previous)
      throw new BackendError(
        503,
        "The archive list changed while loading. Please retry.",
      );
    offset += values.length;
    if (expected !== null && offset >= expected) break;
  }
  if (expected !== null && rows.size !== expected)
    throw new BackendError(
      503,
      "The archive changed while loading. Please reload to see the complete list.",
    );
  return { data: [...rows.values()], count: rows.size };
}
export async function readCatalogue(
  client: SupabaseClient,
  archiveId: string,
  batchId?: string,
  archived = false,
) {
  // RLS defines visibility. No metadata, preview, job, catalogue or ingestion-status gate.
  return allRows<CatalogueRow>(
    (from, to) => {
      let query = client
        .from("archive_items")
        .select(batchId ? "*,import_batch_items!inner(batch_id)" : "*", {
          count: "exact",
        })
        .eq("archive_id", archiveId)
        .order("created_at", { ascending: false })
        .order("id", { ascending: false });
      query = archived
        ? query.not("archived_at", "is", null)
        : query.is("archived_at", null);
      if (batchId) query = query.eq("import_batch_items.batch_id", batchId);
      return query
        .range(from, to)
        .retry(false)
        .overrideTypes<CatalogueRow[], { merge: false }>();
    },
    (row) => row.id,
  );
}
export function catalogueItems(
  rows: CatalogueRow[],
  files: OriginalRow[],
  batchLinks: { item_id: string; batch_id: string }[],
  batchId?: string,
  sets: ImageSetRow[] = [],
): ArchiveItem[] {
  const originals = new Map<string, OriginalRow>();
  const sourceCounts = new Map<string, number>();
  for (const file of files) {
    if (file.purpose !== "original" || file.status !== "stored") continue;
    sourceCounts.set(file.item_id, (sourceCounts.get(file.item_id) || 0) + 1);
    const previous = originals.get(file.item_id);
    if (!previous || (file.page_order ?? 0) < (previous.page_order ?? 0))
      originals.set(file.item_id, file);
  }
  const batches = new Map(
    batchLinks.map((link) => [link.item_id, link.batch_id]),
  );
  const latestSets = new Map<string, ImageSetRow>();
  for (const set of sets) {
    const prior = latestSets.get(set.original_file_id);
    if (!prior || set.created_at > prior.created_at)
      latestSets.set(set.original_file_id, set);
  }
  return rows.map((row) => {
    const original = originals.get(row.id);
    const kind = row.kind || "Other";
    const presentation = cataloguePresentation({kind, title: row.title, datePrecision: row.date_precision, date: row.reported_date, place: row.reported_place, notes: row.notes || row.people_text, catalogued: !!row.catalogued_at});
    return {
      ...presentation,
      rawTitle: row.title || "",
      contributedBy: row.contributed_by,
      datePrecision: row.date_precision,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
      archiveId: row.archive_id,
      id: row.id,
      slug: row.id,
      href: `/archive/${row.id}?archive=${row.archive_id}`,
      title: presentation.title,
      kind,
      date: row.reported_date || "Date not yet known",
      place: row.reported_place || "Place not yet known",
      people: [],
      reportedPeople: row.people_text || "",
      collection: row.catalogued_at ? "Catalogued" : "Uncatalogued",
      image:
        kind === "Audio"
          ? "/images/audio-recording.svg"
          : original
            ? `/api/v1/previews/${original.id}`
            : "/images/empty-archive.svg",
      alt: presentation.title,
      aspect: kind === "Letter" ? "portrait" : "landscape",
      certainty: row.evidence_status,
      year: /^(18|19|20)\d{2}(?:-\d{2}-\d{2})?$/.test(row.reported_date || "")
        ? Number(row.reported_date!.slice(0, 4))
        : undefined,
      notes: row.notes || "",
      tags: [],
      importBatchId: batchId || batches.get(row.id),
      ingestionStatus: row.ingestion_status,
      imageSet: original
        ? latestSets.has(original.id)
          ? imageSet(latestSets.get(original.id)!)
          : undefined
        : undefined,
      archivedAt: row.archived_at || undefined,
      sourceCount: sourceCounts.get(row.id) || 0,
      sourcePreserved: row.ingestion_status === "ready" || !!original,
    };
  });
}
