import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import path from "node:path";
import { readFile } from "node:fs/promises";
const photo = path.resolve("public/images/beach.jpg");
const letter = path.resolve("public/images/letter.jpg");
const routes = [
  "/",
  "/explore",
  "/people",
  "/people/janice-allen",
  "/places",
  "/places/sydney",
  "/stories",
  "/stories/the-summers-we-remember",
  "/archive/a-letter-from-home",
  "/archive/the-camera-that-came-everywhere",
  "/add",
  "/add/bulk",
  "/tree",
  "/about",
];
for (const width of [320, 375, 768, 1024, 1440]) {
  test(`routes fit at ${width}px and source images load`, async ({ page }) => {
    test.setTimeout(120000);
    await page.emulateMedia({ reducedMotion: "reduce" });
    await page.setViewportSize({ width, height: 960 });
    for (const route of routes) {
      const response = await page.goto(route);
      expect(response?.status(), route).toBe(200);
      await page.locator("h1").waitFor();
      await page.evaluate(() => document.fonts.ready);
      await expect(page.locator("h1"), route).toHaveCount(1);
      const overflow = await page.evaluate(() => ({
        scroll: document.documentElement.scrollWidth,
        client: document.documentElement.clientWidth,
      }));
      expect(
        overflow.scroll,
        `${route} overflows at ${width}px`,
      ).toBeLessThanOrEqual(overflow.client);
      const imgs = page.locator("main img:visible");
      for (let i = 0; i < (await imgs.count()); i++) {
        const img = imgs.nth(i);
        await img.scrollIntoViewIfNeeded();
        await expect
          .poll(
            () =>
              img.evaluate(
                (el) =>
                  (el as HTMLImageElement).complete &&
                  (el as HTMLImageElement).naturalWidth > 0,
              ),
            { message: `${route} image ${i} failed` },
          )
          .toBe(true);
      }
    }
  });
}
test("search, filters, empty state, people categories and deep links work", async ({
  page,
}) => {
  await page.goto("/explore");
  await expect(page.locator(".item-card")).toHaveCount(8);
  await page.getByRole("button", { name: "Letters", exact: true }).click();
  await expect(page.locator(".item-card")).toHaveCount(1);
  await page.getByRole("button", { name: "Clear filters" }).click();
  await page
    .getByRole("searchbox", { name: "Search the archive" })
    .fill("rain");
  await expect(page.locator(".item-card")).toHaveCount(2);
  await page
    .getByRole("searchbox", { name: "Search the archive" })
    .fill("no-such-memory");
  await expect(page.getByText("Still waiting to be found.")).toBeVisible();
  await page.getByRole("button", { name: "Show the whole collection" }).click();
  await expect(page.locator(".item-card")).toHaveCount(8);
  await page
    .getByRole("combobox", { name: "People", exact: true })
    .selectOption("janice-allen");
  await expect(page.locator(".item-card")).toHaveCount(4);
  await page.goto("/explore?type=Object");
  await expect(page.locator(".item-card")).toHaveCount(1);
  await page.goto("/explore?unidentified=true");
  await expect(page.locator(".item-card")).toHaveCount(2);
  await page.goto("/people");
  await page.getByRole("button", { name: "Unidentified", exact: true }).click();
  await expect(page.locator(".person-card")).toHaveCount(1);
  await page.getByRole("link", { name: /A face without a name/ }).click();
  await expect(page.locator("h1")).toHaveText("A face without a name");
});
test("letter pages, original view, correction and comments preserve source", async ({
  page,
}) => {
  await page.goto("/archive/a-letter-from-home");
  await page.getByRole("button", { name: "View page 2", exact: true }).click();
  await expect(page.getByText("ORIGINAL · PAGE 2 OF 3")).toBeVisible();
  await page.getByRole("button", { name: "Original", exact: true }).click();
  await expect(page.locator(".transcription-original img")).toBeVisible();
  await page.getByRole("button", { name: "Transcribed", exact: true }).click();
  await page.getByRole("button", { name: "Suggest a correction" }).click();
  await page
    .getByRole("textbox", { name: "Correct the transcription for page 2" })
    .fill("Reviewed words.");
  await page
    .getByRole("button", { name: "Save reviewed text in demo" })
    .click();
  await expect(page.locator(".transcription")).toHaveText("Reviewed words.");
  await page.getByRole("button", { name: "Show raw sample again" }).click();
  await expect(page.locator(".transcription")).toContainText(
    "The weather has been warm",
  );
  await page.getByRole("button", { name: "View larger" }).click();
  await expect(page.getByRole("dialog")).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(page.getByRole("dialog")).not.toBeVisible();
  await page.getByRole("tab", { name: "Comments", exact: true }).click();
  await page
    .getByRole("textbox", { name: "Your memory or comment" })
    .fill("I remember that garden.");
  await page.getByRole("button", { name: "Add comment", exact: true }).click();
  await expect(page.locator(".comment")).toContainText(
    "I remember that garden.",
  );
});
test("mobile letter capture reorders pages, saves without waiting and exports details", async ({
  page,
}) => {
  await page.setViewportSize({ width: 375, height: 850 });
  await page.goto("/add");
  await page
    .getByLabel("Upload existing images", { exact: true })
    .setInputFiles([photo, letter]);
  await page.getByLabel("Material type",{exact:true}).selectOption("Letter");
  await expect(page.locator(".capture-page")).toHaveCount(2);
  await page.getByRole("button", { name: "Move letter.jpg earlier" }).click();
  await page.getByRole("button",{name:"Remove beach.jpg",exact:true}).click();
  await expect(page.locator(".capture-page")).toHaveCount(1);
  await page.getByLabel("Upload existing images",{exact:true}).setInputFiles(photo);
  await expect(page.locator(".capture-page")).toHaveCount(2);
  await page.getByRole("checkbox",{name:"Keep together as one letter",exact:true}).uncheck();
  await expect(page.getByRole("button",{name:"Save to archive",exact:true})).toBeDisabled();
  await page.getByRole("checkbox",{name:"Keep together as one letter",exact:true}).check();
  await page
    .getByRole("combobox", { name: "Role for beach.jpg" })
    .selectOption("envelope-front");
  await page.getByText("Add a note or details (optional)",{exact:true}).click();
  await page
    .getByRole("textbox", { name: "Your recollection, in your words" })
    .fill("Margaret sent this letter around 1956.");
  await page.getByRole("button", { name: "Save to archive" }).click();
  await expect(page).toHaveURL(/\/add\/saved\//);
  await expect(
    page.getByRole("link", { name: "Capture the next item" }),
  ).toBeVisible();
  await expect(page.locator(".saved-context")).toContainText(
    "Margaret sent this letter around 1956.",
  );
  const download = page.waitForEvent("download");
  await page.getByRole("button", { name: "Export capture details" }).click();
  const exported = await download;
  expect(exported.suggestedFilename()).toBe("archive-draft.json");
  const manifest = JSON.parse(await readFile((await exported.path())!, "utf8"));
  expect(manifest.archiveId).toBe("a0000000-0000-4000-8000-000000000001");
  expect(manifest.kind).toBe("Letter");
  expect(manifest.files.map((f:{name:string})=>f.name)).toEqual(["letter.jpg","beach.jpg"]);
  expect(manifest.files[1].role).toBe("envelope-front");
});
test("bulk local review advances and exports batch metadata", async ({
  page,
}) => {
  await page.goto("/add/bulk");
  await page
    .getByLabel("Select images", { exact: true })
    .setInputFiles([photo, letter]);
  await expect(page.getByText("Reviewing 1 of 2")).toBeVisible();
  await page.getByLabel("Who?", { exact: true }).fill("Unknown person");
  await page.getByRole("button", { name: "Save & next" }).click();
  await expect(page.getByText("Reviewing 2 of 2")).toBeVisible();
  await page.getByRole("button", { name: "Save & finish demo" }).click();
  await expect(
    page.getByText("You have catalogued 2 images", { exact: false }),
  ).toBeVisible();
  const download = page.waitForEvent("download");
  await page.getByRole("button", { name: "Export batch details" }).click();
  const exported = await download;
  expect(exported.suggestedFilename()).toBe("archive-draft.json");
  const manifest = JSON.parse(await readFile((await exported.path())!, "utf8"));
  expect(
    manifest.records.every(
      (record: { archiveId: string }) =>
        record.archiveId === "a0000000-0000-4000-8000-000000000001",
    ),
  ).toBe(true);
});
test("navigation is usable on a phone and unknown records return 404", async ({
  page,
}) => {
  await page.setViewportSize({ width: 375, height: 850 });
  await page.goto("/");
  await page.getByRole("button", { name: "Open menu" }).click();
  await page
    .getByRole("navigation", { name: "Mobile navigation" })
    .getByRole("link", { name: "People", exact: true })
    .click();
  await expect(page.locator("h1")).toHaveText("A familiar face.");
  const response = await page.goto("/archive/not-in-this-archive");
  expect(response?.status()).toBe(404);
  await expect(
    page.getByRole("link", { name: "Back to the archive" }),
  ).toBeVisible();
});
for (const route of [
  "/",
  "/explore",
  "/archive/a-letter-from-home",
  "/people",
  "/add",
  "/add/bulk",
  "/tree",
]) {
  test(`basic accessibility: ${route}`, async ({ page }) => {
    await page.goto(route);
    await expect(page.locator("h1")).toBeVisible();
    const result = await new AxeBuilder({ page })
      .withTags(["wcag2a", "wcag2aa", "wcag21aa"])
      .analyze();
    expect(result.violations).toEqual([]);
  });
}
