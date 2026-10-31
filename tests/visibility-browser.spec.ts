import { test, expect } from "@playwright/test";
import { createHash } from "node:crypto";
const archive = "60000000-0000-4000-8000-000000000001",
  item = "60000000-0000-4000-8000-000000000004";
async function login(page: import("@playwright/test").Page, next: string) {
  await page.goto("/sign-in?next=" + encodeURIComponent(next));
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
}
test("real-data path lists all permitted rows and reopens metadata-free, preview-failed items across reload and sign-in", async ({
  page,
  request,
}) => {
  test.setTimeout(90000);
  // Intercept only previews: no real service is contacted or mutated by this suite.
  await page.route("**/api/v1/previews/**", (route) =>
    route.fulfill({
      status: 503,
      json: { error: "Synthetic preview failure" },
    }),
  );
  const expectedCount = (
    await (await request.get("http://127.0.0.1:4301/__fixture/summary")).json()
  ).count;
  await login(page, `/explore?archive=${archive}`);
  await expect(page.locator(".item-card")).toHaveCount(expectedCount, {
    timeout: 30000,
  });
  await expect(page.locator(".search-count")).toContainText("1007 items");
  const card = page.locator(".item-card").filter({
    has: page.getByRole("heading", {
      name: "Photograph, still to be catalogued",
      exact: true,
    }),
  });
  await card.scrollIntoViewIfNeeded();
  await expect(
    card.getByText("Preview unavailable", { exact: true }),
  ).toBeVisible({ timeout: 10000 });
  await expect(
    card.getByText("Original safely preserved", { exact: true }),
  ).toBeVisible();
  await card.getByRole("link", { name: "Open item", exact: false }).click();
  await expect(page).toHaveURL(new RegExp(`/archive/${item}`), {
    timeout: 30000,
  });
  await expect(
    page.getByRole("heading", {
      name: "Photograph, still to be catalogued",
      exact: true,
    }),
  ).toBeVisible();
  await expect(page.locator(".saved-file-list")).toHaveCount(2);
  await expect(
    page.getByRole("link", { name: "Edit catalogue details", exact: false }),
  ).toBeVisible();
  await expect(
    page.getByLabel("Add a recollection", { exact: true }),
  ).toBeVisible();
  await page.reload();
  await expect(
    page.getByRole("heading", {
      name: "Photograph, still to be catalogued",
      exact: true,
    }),
  ).toBeVisible();
  await page
    .getByRole("link", { name: "Edit catalogue details", exact: false })
    .click();
  await expect(
    page.getByLabel("Title / caption", { exact: true }),
  ).toBeVisible();
  await expect(page.getByLabel("People", { exact: true })).toBeVisible();
  await page.getByRole("link", { name: "Back to item", exact: true }).click();
  await expect(
    page.getByRole("heading", {
      name: "Photograph, still to be catalogued",
      exact: true,
    }),
  ).toBeVisible();
  const href = await page
    .locator(".saved-file-list a")
    .first()
    .getAttribute("href");
  const original = await page.request.get(href!);
  expect(original.status()).toBe(200);
  const fixture = await request.get("http://127.0.0.1:4301/__fixture/summary");
  expect(
    createHash("sha256")
      .update(await original.body())
      .digest("hex"),
  ).toBe((await fixture.json()).originalHash);
  const savedUrl = page.url();
  await page.getByRole("button", { name: "Demo profile" }).click();
  await page.getByRole("button", { name: "Sign out", exact: true }).click();
  await expect(page).toHaveURL(/sign-in/);
  await login(page, new URL(savedUrl).pathname);
  await expect(
    page.getByRole("heading", {
      name: "Photograph, still to be catalogued",
      exact: true,
    }),
  ).toBeVisible();
  await page.context().addCookies([
    {
      name: "active_archive",
      value: archive,
      url: "http://127.0.0.1:4300",
      httpOnly: true,
      sameSite: "Lax",
    },
  ]);
  await page.goto("/");
  await page
    .getByRole("link", { name: "View everything", exact: false })
    .click();
  await expect(page).toHaveURL(
    `http://127.0.0.1:4300/explore?archive=${archive}`,
  );
  await expect(page.locator(".item-card")).toHaveCount(expectedCount, {
    timeout: 30000,
  });
  await page.context().addCookies([
    {
      name: "active_archive",
      value: "60000000-0000-4000-8000-000000000002",
      url: "http://127.0.0.1:4300",
      httpOnly: true,
      sameSite: "Lax",
    },
  ]);
  await page.goto("/explore?batch=60000000-0000-4000-8000-000000000005");
  await expect(page.locator(".item-card")).toHaveCount(1);
  await expect(
    page
      .locator(".item-card")
      .getByRole("heading", { name: "Photograph, still to be catalogued" }),
  ).toBeVisible();
  await page
    .getByRole("link", { name: "View the whole archive", exact: false })
    .click();
  await expect(page.locator(".item-card")).toHaveCount(expectedCount, {
    timeout: 30000,
  });
  await request.post("http://127.0.0.1:4301/__fixture/failure?list=1");
  await page.goto(`/explore?archive=${archive}`);
  await expect(
    page.getByRole("heading", { name: "The archive list could not load." }),
  ).toBeVisible();
  await expect(page.locator(".search-count")).toHaveCount(0);
  await page.goto(`/archive/${item}`);
  await expect(
    page.getByRole("heading", {
      name: "Photograph, still to be catalogued",
      exact: true,
    }),
  ).toBeVisible();
});
