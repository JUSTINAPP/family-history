import { test, expect } from "@playwright/test";
import { readFile } from "node:fs/promises";
test("capture renders HEIC locally while retaining its original File", async ({
  page,
}) => {
  await page.goto("/add");
  const bytes = await readFile("tests/fixtures/preview.heic");
  await page
    .getByLabel("Upload existing images", { exact: true })
    .setInputFiles({
      name: "IMG_6390.HEIC",
      mimeType: "image/heic",
      buffer: bytes,
    });
  const image = page.getByAltText("Original local preview of IMG_6390.HEIC");
  await expect(image).toBeVisible({ timeout: 20000 });
  expect(
    await image.evaluate((node) => (node as HTMLImageElement).naturalWidth),
  ).toBe(48);
  await expect(page.getByText("ORIGINAL · IMG_6390.HEIC")).toBeVisible();
  await expect(
    page.getByText("Preview unavailable", { exact: true }),
  ).toHaveCount(0);
});

test("an undecodable HEIC keeps the original selected for a capture attempt", async ({
  page,
}) => {
  await page.goto("/add");
  await page
    .getByLabel("Upload existing images", { exact: true })
    .setInputFiles({
      name: "damaged.HEIC",
      mimeType: "image/heic",
      buffer: Buffer.from("not a decodable image"),
    });
  await expect(
    page.getByText("Preview will be retried after import").first(),
  ).toBeVisible({ timeout: 20000 });
  await expect(page.getByText("ORIGINAL · damaged.HEIC")).toBeVisible();
  await expect(page.getByRole("button", { name: "Save & view" })).toBeEnabled();
});
