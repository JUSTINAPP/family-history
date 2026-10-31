import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { safeNext } from "../src/lib/backend/errors";
import { imageMime } from "../src/lib/backend/validation";

test("private routes fail closed without an authenticated session", async ({
  request,
}) => {
  for (const route of [
    "/",
    "/explore",
    "/add",
    "/admin",
    "/admin/members",
    "/people",
    "/archive/a-letter-from-home",
  ]) {
    const response = await request.get(route, { maxRedirects: 0 });
    expect(response.status(), route).toBe(307);
    expect(response.headers().location).toContain("/sign-in");
    expect(response.headers()["cache-control"]).toContain("no-store");
  }
});
test("private APIs do not accept anonymous uploads or disclose source records", async ({
  request,
}) => {
  const workspace = await request.get("/api/v1/workspace");
  expect(workspace.status()).toBe(401);
  const upload = await request.post("/api/v1/ingestions", {
    data: "not an upload",
  });
  expect(upload.status()).toBe(401);
  const source = await request.get(
    "/api/v1/files/10000000-0000-4000-8000-000000000001",
  );
  expect(source.status()).toBe(401);
  expect(source.headers()["cache-control"]).toContain("no-store");
  const forged = await request.post("/api/v1/ingestions", {
    headers: { Origin: "https://untrusted.example" },
    data: "forged",
  });
  expect(forged.status()).toBe(403);
});
test("sign-in keeps local redirects safe and remains accessible on a phone", async ({
  page,
}) => {
  await page.setViewportSize({ width: 375, height: 850 });
  await page.goto("/sign-in?next=https://untrusted.example");
  await expect(
    page.getByRole("heading", { name: "Come on in." }),
  ).toBeVisible();
  await expect(page.locator("input[name=next]")).toHaveValue("/");
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
test("redirect and file-signature validation reject untrusted input", () => {
  for (const value of [
    "//untrusted.example",
    "/\\untrusted.example",
    "https://untrusted.example",
    "/auth/callback",
    "/\nredirect",
  ])
    expect(safeNext(value)).toBe("/");
  expect(safeNext("/explore")).toBe("/explore");
  expect(
    imageMime(new TextEncoder().encode('<svg onload="evil()"/>')),
  ).toBeNull();
  expect(imageMime(new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10]))).toBe(
    "image/png",
  );
  expect(imageMime(new Uint8Array([0xff, 0xd8, 0xff]))).toBe("image/jpeg");
});
