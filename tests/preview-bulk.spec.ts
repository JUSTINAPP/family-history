import { test, expect } from "@playwright/test";
import { readFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import sharp from "sharp";
import type { SupabaseClient } from "@supabase/supabase-js";
import { convertPreview } from "../src/lib/preview/convert";
import { importPhotographs, type ImportEntry } from "../src/lib/bulk-import";
import { imageMime } from "../src/lib/backend/validation";

test("HEIC produces a faithful separate JPEG without changing original bytes", async () => {
  const bytes = await readFile("tests/fixtures/preview.heic");
  const before = createHash("sha256").update(bytes).digest("hex");
  expect(imageMime(bytes)).toBe("image/heic");
  const preview = await convertPreview(bytes);
  expect([preview.width, preview.height]).toEqual([48, 32]);
  expect((await sharp(preview.bytes).metadata()).format).toBe("jpeg");
  const { data } = await sharp(preview.bytes)
    .removeAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });
  expect(data[0]).toBeGreaterThan(140); // Synthetic red field stays red, not a replacement image.
  expect(data[1]).toBeLessThan(75);
  expect(createHash("sha256").update(bytes).digest("hex")).toBe(before);
});

test("JPEG EXIF orientation is applied to a display copy only", async () => {
  const original = await sharp({
    create: { width: 12, height: 8, channels: 3, background: "blue" },
  })
    .jpeg()
    .withMetadata({ orientation: 6 })
    .toBuffer();
  const preview = await convertPreview(original);
  expect([preview.width, preview.height]).toEqual([8, 12]);
  expect((await sharp(original).metadata()).orientation).toBe(6);
  expect((await sharp(preview.bytes).metadata()).orientation).toBeUndefined();
});

test("HEIF container rotation is applied exactly once without changing the source", async () => {
  const source = await readFile("tests/fixtures/preview.heic");
  const rotation = source.indexOf("irot");
  expect(rotation).toBeGreaterThan(0);
  // The genuine HEIF fixture contains an associated irot property. Change only
  // this test-local copy to request a 90° container rotation (encoded pixels stay 48×32).
  source[rotation + 4] = 1;
  const before = createHash("sha256").update(source).digest("hex");
  const preview = await convertPreview(source);
  expect([preview.width, preview.height]).toEqual([32, 48]);
  expect((await sharp(preview.bytes).metadata()).orientation).toBeUndefined();
  expect(createHash("sha256").update(source).digest("hex")).toBe(before);
});

test("PNG and WebP keep their original hashes and produce browser-compatible display copies", async () => {
  for (const format of ["png", "webp"] as const) {
    const original = await sharp({
      create: {
        width: 41,
        height: 29,
        channels: 4,
        background: { r: 30, g: 70, b: 210, alpha: 0.5 },
      },
    })
      .toFormat(format)
      .toBuffer();
    const before = createHash("sha256").update(original).digest("hex");
    const preview = await convertPreview(original);
    expect((await sharp(preview.bytes).metadata()).format).toBe("jpeg");
    expect([preview.width, preview.height]).toEqual([41, 29]);
    expect(createHash("sha256").update(original).digest("hex")).toBe(before);
  }
});

test("decoder failures retain their useful error code and leave input bytes unchanged", async () => {
  const bytes = Buffer.from("damaged HEIC bytes");
  const before = Buffer.from(bytes);
  await expect(convertPreview(bytes)).rejects.toMatchObject({
    code: "render_failed",
    status: 422,
  });
  expect(bytes).toEqual(before);
});

test("bulk import creates one metadata-free item per file and retries only failures with stable capture IDs", async () => {
  const entries: ImportEntry[] = ["one.jpg", "two.heic", "three.png"].map(
    (name, index) => ({
      file: new File([new Uint8Array([index])], name),
      captureId: `capture-${index}`,
      status: "pending",
    }),
  );
  const state = new Map(entries.map((entry) => [entry.captureId, entry]));
  const attempts: string[] = [];
  let fail = true;
  const ingest = async (_client: SupabaseClient, form: FormData) => {
    const id = String(form.get("captureId"));
    attempts.push(id);
    expect(form.getAll("files")).toHaveLength(1);
    expect(form.get("context")).toBe("");
    expect(form.get("quick")).toBe('{"precision":"unknown"}');
    if (id === "capture-1" && fail) throw new Error("Connection interrupted");
    return { id: `item-${id}` };
  };
  const changed = (entry: ImportEntry) => {
    state.set(entry.captureId, entry);
  };
  await importPhotographs(
    {} as SupabaseClient,
    entries,
    "archive-a",
    "",
    changed,
    ingest,
  );
  expect([...state.values()].map((e) => e.status)).toEqual([
    "saved",
    "failed",
    "saved",
  ]);
  fail = false;
  await importPhotographs(
    {} as SupabaseClient,
    [...state.values()],
    "archive-a",
    "",
    changed,
    ingest,
  );
  expect(attempts).toEqual([
    "capture-0",
    "capture-1",
    "capture-2",
    "capture-1",
  ]);
  expect([...state.values()].every((e) => e.status === "saved")).toBe(true);
});

test("batch context stays separate from individual metadata and recollections", async () => {
  const file = new File([new Uint8Array([1])], "a.jpg");
  await importPhotographs(
    {} as SupabaseClient,
    [{ captureId: "stable", file, status: "pending" }],
    "archive-a",
    "Janice’s photo box",
    () => {},
    async (_client, form) => {
      expect(form.get("context")).toBe("");
      expect(form.get("title")).toBe("Photograph, still to be catalogued");
      expect(JSON.parse(String(form.get("quick")))).toEqual({
        precision: "unknown",
      });
      return { id: "item-a" };
    },
  );
});

test("generic HEIF is recognised without accepting an AVIF container as HEIC", () => {
  const header = (major: string) =>
    new Uint8Array([
      0,
      0,
      0,
      24,
      ...new TextEncoder().encode(`ftyp${major}0000mif1`),
    ]);
  expect(imageMime(header("mif1"))).toBe("image/heif");
  expect(imageMime(header("avif"))).toBeNull();
});
