import { test, expect } from "@playwright/test";
import {
  allRows,
  catalogueItems,
  type CatalogueRow,
} from "../src/lib/backend/catalogue";
const row = (id: string, status = "ready"): CatalogueRow => ({
  id,
  archive_id: "archive",
  title: null,
  kind: "Photograph",
  reported_date: null,
  reported_place: null,
  people_text: null,
  catalogued_at: null,
  evidence_status: "family_reported",
  notes: null,
  ingestion_status: status,
});
test("all permitted rows are fetched beyond the API cap and counted exactly", async () => {
  const rows = Array.from({ length: 1207 }, (_, i) => ({ id: String(i) }));
  const offsets: number[] = [];
  const result = await allRows(
    async (from) => {
      offsets.push(from);
      return {
        data: rows.slice(from, from + 73),
        count: rows.length,
        error: null,
      };
    },
    (r) => r.id,
  );
  expect(result.count).toBe(1207);
  expect(result.data).toHaveLength(1207);
  expect(offsets.length).toBeGreaterThan(10);
});
test("an error or incomplete result never masquerades as an empty complete archive", async () => {
  await expect(
    allRows(
      async () => ({ data: null, error: { message: "failure" } }),
      (r: { id: string }) => r.id,
    ),
  ).rejects.toMatchObject({ status: 503 });
  await expect(
    allRows(
      async (from) => ({
        data: from ? [] : [{ id: "one" }],
        count: 2,
        error: null,
      }),
      (r) => r.id,
    ),
  ).rejects.toMatchObject({ status: 503 });
});
test("missing metadata, preview files, failed jobs or incomplete ingestion cannot remove an RLS-visible row", () => {
  const rows = [
    row("saved"),
    row("receipt-stored", "failed"),
    row("owned-draft", "uploading"),
  ];
  const result = catalogueItems(
    rows,
    [
      {
        id: "original",
        item_id: "receipt-stored",
        status: "stored",
        purpose: "original",
      },
    ],
    [],
  );
  expect(result).toHaveLength(rows.length);
  expect(result[0].title).toBe("Photograph, still to be catalogued");
  expect(result[0].collection).toBe("Uncatalogued");
  expect(result[0].sourcePreserved).toBe(true);
  expect(result[1].image).toBe("/api/v1/previews/original");
  expect(result[1].sourcePreserved).toBe(true);
  expect(result[2].sourcePreserved).toBe(false);
  expect(result.map((r) => r.href)).toEqual(
    rows.map((r) => `/archive/${r.id}?archive=archive`),
  );
});

test("a multi-source item uses its first page without hiding its other originals", () => {
  const cards = catalogueItems(
    [row("group")],
    [
      {
        id: "back",
        item_id: "group",
        purpose: "original",
        status: "stored",
        page_order: 1,
      },
      {
        id: "front",
        item_id: "group",
        purpose: "original",
        status: "stored",
        page_order: 0,
      },
    ],
    [],
  );
  expect(cards).toHaveLength(1);
  expect(cards[0].image).toBe("/api/v1/previews/front");
});
