import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { readFile } from "node:fs/promises";
import type { SupabaseClient } from "@supabase/supabase-js";
import { importPhotographs, type ImportEntry } from "../src/lib/bulk-import";
import { resumeEntries } from "../src/lib/bulk-resume";
import { audioChecksum } from "../src/lib/audio/validation";
for (const count of [2, 20])
  test(`${count} separate photograph selections produce ${count} independent imports`, async () => {
    const entries: ImportEntry[] = Array.from({ length: count }, (_, i) => ({
      captureId: `capture-${i}`,
      file: new File([new Uint8Array([i + 1])], `photo-${i}.jpg`),
      status: "pending",
    }));
    const ids = new Set<string>();
    await importPhotographs(
      {} as SupabaseClient,
      entries,
      "archive",
      "Shared batch context",
      () => {},
      async (_client, form) => {
        expect(form.getAll("files")).toHaveLength(1);
        expect(form.get("context")).toBe("");
        const id = String(form.get("captureId"));
        ids.add(id);
        return { id };
      },
      "batch",
    );
    expect(ids.size).toBe(count);
  });
test("reselection after reload skips saved sources, retains unfinished capture IDs and adds not-yet-started files", async () => {
  const original = new File([new Uint8Array([1])], "one.jpg"),
    unfinished = new File([new Uint8Array([2])], "two.jpg"),
    third = new File([new Uint8Array([3])], "three.jpg");
  const sources = [
    {
      captureId: "saved",
      itemId: "item-1",
      status: "saved" as const,
      fileName: "one.jpg",
      size: 1,
      sha256: await audioChecksum(new Uint8Array(await original.arrayBuffer())),
    },
    {
      captureId: "unfinished",
      itemId: "item-2",
      status: "failed" as const,
      fileName: "two.jpg",
      size: 1,
      sha256: await audioChecksum(
        new Uint8Array(await unfinished.arrayBuffer()),
      ),
    },
  ];
  const entries = await resumeEntries([original, unfinished, third], sources);
  const attempts: string[] = [];
  await importPhotographs(
    {} as SupabaseClient,
    entries,
    "archive",
    "",
    () => {},
    async (_client, form) => {
      const id = String(form.get("captureId"));
      attempts.push(id);
      return { id };
    },
    "batch",
  );
  expect(attempts).toHaveLength(2);
  expect(attempts).toContain("unfinished");
  expect(attempts).not.toContain("saved");
  expect(entries).toHaveLength(3);
});
test("separate-photo intent hands selected files to bulk, reports completion and exposes two Explore entries", async ({
  page,
}) => {
  const bytes = await readFile("public/images/beach.jpg");
  await page.goto("/add");
  await page
    .getByLabel("Upload existing images", { exact: true })
    .setInputFiles([
      { name: "one.jpg", mimeType: "image/jpeg", buffer: bytes },
      { name: "two.jpg", mimeType: "image/jpeg", buffer: bytes },
    ]);
  await page.getByLabel("Material type",{exact:true}).selectOption("Photograph");
  await expect(page.getByText("2 photographs selected",{exact:true})).toBeVisible();
  await page.getByLabel("A note about these photographs (optional)",{exact:true}).fill("Janice’s photo box");
  await page.getByRole("button",{name:"Save 2 photographs",exact:true}).click();
  await expect(
    page.getByRole("heading", {
      name: "2 photographs safely added to The Allen & Cork Archive",
    }),
  ).toBeVisible();
  await page
    .getByRole("link", { name: "View imported photographs", exact: false })
    .click();
  await expect(page.locator(".item-card")).toHaveCount(2);
  await expect(
    page.getByRole("heading", { name: "Photograph, still to be catalogued" }),
  ).toHaveCount(2);
});
test("twenty library photographs save as twenty independent archive items through the embedded import",async({page})=>{
 test.setTimeout(120000);
 const bytes=await readFile("public/images/beach.jpg");await page.goto("/add");
 await page.getByLabel("Upload existing images",{exact:true}).setInputFiles(Array.from({length:20},(_,i)=>({name:`photo-${i+1}.jpg`,mimeType:"image/jpeg",buffer:bytes})));
 await page.getByLabel("Material type",{exact:true}).selectOption("Photograph");
 await expect(page.getByText("20 photographs selected",{exact:true})).toBeVisible();
 await page.getByRole("button",{name:"Save 20 photographs",exact:true}).click();
 await expect(page.getByRole("region",{name:"Import complete",exact:true})).toContainText("20 photographs safely added");
 await page.getByRole("link",{name:/View imported photographs/}).click();
 await expect(page.locator(".item-card")).toHaveCount(20);
});
test("front and back explicitly grouped remain one item with two source files", async ({
  page,
}) => {
  await page.goto("/add");
  await page
    .getByLabel("Upload existing images", { exact: true })
    .setInputFiles(["public/images/beach.jpg", "public/images/letter.jpg"]);
  await page.getByLabel("Material type",{exact:true}).selectOption("Photograph");
  await page.getByText("Front and back of one photograph?",{exact:true}).click();
  await page.getByRole("checkbox",{name:"Keep together as one item",exact:true}).check();
  await page.getByRole("button", { name: "Save to archive", exact: true }).click();
  await expect(page).toHaveURL(/add\/saved/);
  await expect(page.locator(".saved-file-list")).toContainText("beach.jpg");
  await expect(page.locator(".saved-file-list")).toContainText("letter.jpg");
});
test("new bulk import layout explains group context and stays accessible on mobile", async ({
  page,
}) => {
  await page.setViewportSize({ width: 375, height: 850 });
  await page.goto("/add/bulk?workflow=import");
  await expect(
    page.getByText("Kept once with this import batch.", { exact: false }),
  ).toBeVisible();
  expect(
    await page.evaluate(
      () =>
        document.documentElement.scrollWidth -
        document.documentElement.clientWidth,
    ),
  ).toBeLessThanOrEqual(0);
  expect(
    (
      await new AxeBuilder({ page })
        .withTags(["wcag2a", "wcag2aa", "wcag21aa"])
        .analyze()
    ).violations,
  ).toEqual([]);
});
