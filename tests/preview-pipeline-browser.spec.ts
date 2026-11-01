import { test, expect } from "@playwright/test";
import { createHash } from "node:crypto";
import sharp from "sharp";
const archive = "60000000-0000-4000-8000-000000000001";
const item = "60000000-0000-4000-8000-000000000004";
const sources = [
  "63000000-0000-4000-8000-000000000000",
  "63000000-0000-4000-9000-000000000000",
];
test("production build retrospectively converts two preserved HEICs and privately displays their JPEGs", async ({
  page,
  request,
}) => {
  test.setTimeout(120000);
  await page.goto("/sign-in?next=" + encodeURIComponent("/add"));
  await page
    .getByLabel("Email", { exact: true })
    .fill("visibility@example.test");
  await page
    .getByLabel("Password", { exact: true })
    .fill("local-fixture-password");
  await page
    .locator("form")
    .getByRole("button", { name: "Sign in", exact: true })
    .click();
  await expect(page).toHaveURL(/\/add$/);
  await request.post("http://127.0.0.1:4301/__fixture/failure?preview=1");
  const failed = await page.request.post(`/api/v1/previews/${sources[0]}`, {
    headers: { origin: "http://127.0.0.1:4300" },
  });
  expect(failed.status(), await failed.text()).toBe(503);
  expect(await failed.json()).toMatchObject({
    code: "source_download_failed",
    stage: "download",
  });
  await page.goto(`/archive/${item}`);
  await expect(
    page.getByRole("button", { name: "Retry preview", exact: true }),
  ).toHaveCount(2, { timeout: 20000 });
  await request.post("http://127.0.0.1:4301/__fixture/failure?preview=0");
  for (let index = 0; index < 2; index++) {
    const image = page.locator(".saved-original").nth(index);
    await image
      .getByRole("button", { name: "Retry preview", exact: true })
      .click();
    await expect
      .poll(
        () =>
          image
            .locator("img")
            .evaluateAll(
              (nodes) =>
                nodes.length === 1 &&
                (nodes[0] as HTMLImageElement).naturalWidth > 0,
            ),
        { timeout: 30000 },
      )
      .toBe(true);
  }
  for (const source of sources) {
    const response = await page.request.post(`/api/v1/previews/${source}`, {
      headers: { origin: "http://127.0.0.1:4300" },
    });
    expect(response.status(), await response.text()).toBe(200);
    const image = await page.request.get(`/api/v1/previews/${source}`);
    expect(image.status()).toBe(200);
    expect(image.headers()["cache-control"]).toContain("private");
    expect((await sharp(await image.body()).metadata()).format).toBe("jpeg");
  }
  await page.goto(`/archive/${item}`);
  await expect(page.locator(".saved-original img")).toHaveCount(2);
  await expect
    .poll(() =>
      page
        .locator(".saved-original img")
        .evaluateAll((nodes) =>
          nodes.every((n) => (n as HTMLImageElement).naturalWidth > 0),
        ),
    )
    .toBe(true);
  await page.reload();
  await expect
    .poll(() =>
      page
        .locator(".saved-original img")
        .evaluateAll(
          (nodes) =>
            nodes.length === 2 &&
            nodes.every((n) => (n as HTMLImageElement).naturalWidth > 0),
        ),
    )
    .toBe(true);
  const summary = await (
    await request.get("http://127.0.0.1:4301/__fixture/summary")
  ).json();
  expect(summary.displays).toHaveLength(2);
  expect(summary.imageSets).toHaveLength(2);
  for (const set of summary.imageSets) {
    expect(set.placeholder).toMatch(/^data:image\/webp;base64,/);
    expect(set.manifest.thumbnail.size).toBeLessThan(set.manifest.display.size);
    expect(set.manifest.small.size).toBeLessThanOrEqual(
      set.manifest.thumbnail.size,
    );
    const thumbnail = await page.request.get(
      `/api/v1/assets/${set.thumbnail_file_id}`,
    );
    expect(thumbnail.status()).toBe(200);
    expect(thumbnail.headers()["server-timing"]).toContain("storage;dur=");
    expect((await sharp(await thumbnail.body()).metadata()).format).toBe(
      "webp",
    );
  }
  expect(
    summary.attempts.every((a: { status: string }) => a.status === "complete"),
  ).toBe(true);
  for (const f of summary.displays) {
    expect(f.bucket_id).toBe("archive-derived");
    expect(f.status).toBe("stored");
  }
  expect(summary.originalHashes).toEqual([
    summary.originalHash,
    summary.originalHash,
  ]);
  for (const source of sources) {
    const response = await page.request.get(`/api/v1/files/${source}`);
    expect(
      createHash("sha256")
        .update(await response.body())
        .digest("hex"),
    ).toBe(summary.originalHash);
  }
  await page.goto(`/explore?archive=${archive}`);
  await expect
    .poll(() =>
      page
        .locator(".item-card img")
        .evaluateAll(
          (nodes) =>
            nodes.length === 1 &&
            nodes.every((n) => (n as HTMLImageElement).naturalWidth > 0),
        ),
    )
    .toBe(true);
  const gridImage = page.locator(".item-card img").first();
  await expect(gridImage).toHaveAttribute("loading", "lazy");
  await expect(gridImage).toHaveAttribute("srcset", / \d+w/);
  await expect(gridImage).toHaveAttribute("sizes", /vw/);
  expect(
    await gridImage.evaluate((n) => (n as HTMLImageElement).currentSrc),
  ).toMatch(/\/api\/v1\/assets\//);
  expect(await gridImage.getAttribute("srcset")).not.toContain(
    summary.imageSets[0].display_file_id,
  );
  await expect(page.locator(".item-card .has-placeholder")).toHaveCSS(
    "background-image",
    /data:image\/webp/,
  );
  await expect(gridImage).toHaveCSS("opacity", "1");
  // Real Next server actions, with protocol fixture transport; actual SQL/RLS is tested separately.
  await page.goto(`/archive/${item}/manage`);
  await expect(
    page.getByRole("button", {
      name: "Review permanent deletion",
      exact: true,
    }),
  ).toBeDisabled();
  await page.getByRole("button", { name: "Archive item", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "Restore archived item", exact: true }),
  ).toBeVisible();
  await page.goto(`/explore?archive=${archive}`);
  await expect(page.locator(".item-card")).toHaveCount(0);
  await page.goto(`/explore?archive=${archive}&state=archived`);
  await expect(page.locator(".item-card")).toHaveCount(1);
  await page.goto(`/archive/${item}/manage`);
  await page
    .getByRole("button", { name: "Restore archived item", exact: true })
    .click();
  await expect(
    page.getByRole("button", { name: "Archive item", exact: true }),
  ).toBeVisible();
  await page
    .getByRole("button", {
      name: "Split photographs into separate items",
      exact: true,
    })
    .click();
  await expect(
    page.getByRole("button", {
      name: "Confirm split photographs",
      exact: true,
    }),
  ).toBeDisabled();
  await page.getByLabel("Split confirmation", { exact: true }).fill("SPLIT");
  await page
    .getByRole("checkbox", { name: /existing context will be retained/ })
    .check();
  await page
    .getByRole("button", { name: "Confirm split photographs", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: "Separated photographs", exact: true }),
  ).toBeVisible();
  const splitSummary = await (
    await request.get("http://127.0.0.1:4301/__fixture/summary")
  ).json();
  const children = splitSummary.items.filter(
    (r: { split_from?: string }) => r.split_from === item,
  );
  expect(children).toHaveLength(2);
  for (const child of children)
    expect(
      splitSummary.files.filter(
        (f: { item_id: string; purpose: string }) =>
          f.item_id === child.id && f.purpose === "original",
      ),
    ).toHaveLength(1);
  await page.goto(`/explore?archive=${archive}`);
  await expect(page.locator(".item-card")).toHaveCount(2);
  await page.goto(`/archive/${children[0].id}/manage`);
  await page.getByRole("button", { name: "Archive item", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "Restore archived item", exact: true }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Review permanent deletion", exact: true })
    .click();
  await expect(
    page.getByRole("button", {
      name: "Confirm permanent deletion",
      exact: true,
    }),
  ).toBeDisabled();
  await page.getByLabel("Delete confirmation", { exact: true }).fill("DELETE");
  await expect(
    page.getByRole("button", {
      name: "Confirm permanent deletion",
      exact: true,
    }),
  ).toBeDisabled();
  await page
    .getByRole("checkbox", { name: /confirm permanent removal/ })
    .check();
  await request.post("http://127.0.0.1:4301/__fixture/failure?delete=1");
  await page
    .getByRole("button", { name: "Confirm permanent deletion", exact: true })
    .click();
  await expect(page.getByRole("status")).toContainText(
    "Deletion is in progress",
  );
  await page.reload();
  await expect(
    page.getByText("Permanent deletion is in progress.", { exact: false }),
  ).toBeVisible();
  await request.post("http://127.0.0.1:4301/__fixture/failure?delete=0");
  await page
    .getByRole("button", { name: "Review permanent deletion", exact: true })
    .click();
  await page.getByLabel("Delete confirmation", { exact: true }).fill("DELETE");
  await page
    .getByRole("checkbox", { name: /confirm permanent removal/ })
    .check();
  await page
    .getByRole("button", { name: "Confirm permanent deletion", exact: true })
    .click();
  await expect(page).toHaveURL(new RegExp(`/explore\\?archive=${archive}`));
  await expect(page.locator(".item-card")).toHaveCount(1);
  await request.post("http://127.0.0.1:4301/__fixture/many");
  const imageRequests = new Set<string>();
  page.on("request", (r) => {
    if (r.resourceType() === "image" && r.url().includes("/api/v1/assets/"))
      imageRequests.add(new URL(r.url()).pathname);
  });
  await page.goto(`/explore?archive=${archive}`);
  await expect(page.locator(".item-card")).toHaveCount(97);
  await expect
    .poll(() =>
      page
        .locator(".item-card img")
        .first()
        .evaluate((n) => (n as HTMLImageElement).naturalWidth),
    )
    .toBeGreaterThan(0);
  expect(imageRequests.size).toBeLessThan(97);
  const lastImage = page.locator(".item-card img").last();
  await expect(lastImage).toHaveAttribute("loading", "lazy");
  expect(
    await lastImage.evaluate((n) => (n as HTMLImageElement).naturalWidth),
  ).toBe(0);
  await lastImage.scrollIntoViewIfNeeded();
  await expect
    .poll(() => lastImage.evaluate((n) => (n as HTMLImageElement).naturalWidth))
    .toBeGreaterThan(0);
  await page.getByRole("button", { name: "Demo profile" }).click();
  await page.getByRole("button", { name: "Sign out", exact: true }).click();
  await expect(page).toHaveURL(/sign-in/);
  expect(
    (await page.request.get(`/api/v1/previews/${sources[0]}`)).status(),
  ).toBe(401);
  expect(
    (
      await page.request.get(
        `/api/v1/assets/${summary.imageSets[0].thumbnail_file_id}`,
      )
    ).status(),
  ).toBe(401);
  expect(
    (
      await request.get(
        `http://127.0.0.1:4301/storage/v1/object/authenticated/${summary.displays[0].bucket_id}/${summary.displays[0].storage_path}`,
      )
    ).status(),
  ).toBe(401);
});
