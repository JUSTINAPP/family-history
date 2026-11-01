// Local synthetic fixtures only. Never uses the configured hosted Supabase project.
import { spawn } from "node:child_process";
import { chromium } from "@playwright/test";
import {
  fixtureServer,
  ARCHIVE,
} from "../tests/fixtures/visibility-server.mjs";
const development = process.env.PROFILE_DEV === "1";
const { server } = await fixtureServer(4301, {
  previewFile: "tests/fixtures/preview.heic",
  management: true,
});
const app = spawn(
  process.execPath,
  [
    "node_modules/next/dist/bin/next",
    development ? "dev" : "start",
    "--hostname",
    "127.0.0.1",
    "--port",
    "4300",
  ],
  {
    env: {
      ...process.env,
      ARCHIVE_DEMO_MODE: "false",
      ARCHIVE_BUILD_DIR: ".next-test",
      NEXT_PUBLIC_SUPABASE_URL: "http://127.0.0.1:4301",
      NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: "fixture-public-key",
      ...(development ? { ARCHIVE_PERF_DIAGNOSTICS: "1" } : {}),
    },
    stdio: ["ignore", "pipe", "pipe"],
  },
);
let output = "";
for (const s of [app.stdout, app.stderr])
  s.on("data", (c) => {
    output = (output + c).slice(-2000);
    if (development) process.stdout.write(c);
  });
let browser;
try {
  for (let i = 0; i < 100; i++) {
    try {
      if ((await fetch("http://127.0.0.1:4300/sign-in")).ok) break;
    } catch {}
    await new Promise((r) => setTimeout(r, 200));
  }
  browser = await chromium.launch({
    headless: true,
    ...(process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH
      ? { executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH }
      : {}),
  });
  const context = await browser.newContext();
  const page = await context.newPage();
  let browserDiagnostics = 0;
  page.on("console", async (message) => {
    if (!development) return;
    for (const argument of message.args()) {
      const value = await argument.jsonValue().catch(() => null);
      if (value?.event === "archive_browser") {
        browserDiagnostics++;
        console.log(JSON.stringify(value));
      }
    }
  });
  await page.route("**/*", (route) => {
    const h = route.request().headers();
    return h["next-router-prefetch"] === "1" || h.purpose === "prefetch"
      ? route.abort()
      : route.continue();
  });
  await context.addCookies([
    {
      name: "active_archive",
      value: ARCHIVE,
      url: "http://127.0.0.1:4300",
      httpOnly: true,
    },
  ]);
  await page.goto("http://127.0.0.1:4300/sign-in");
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
  await page.waitForURL("http://127.0.0.1:4300/");
  await page.waitForLoadState("networkidle");
  for (const route of [
    "/",
    "/explore",
    "/people",
    "/people/64000000-0000-4000-8000-000000000000",
  ]) {
    await fetch("http://127.0.0.1:4301/__fixture/metrics?reset=1");
    await page.goto("http://127.0.0.1:4300" + route);
    await page.waitForLoadState("networkidle");
    if (development) await page.waitForTimeout(700);
    const queries = await (
      await fetch("http://127.0.0.1:4301/__fixture/metrics")
    ).json();
    const nav = await page.evaluate(() => {
      const n = performance.getEntriesByType("navigation")[0];
      return {
        responseStartMs: Math.round(n.responseStart),
        responseEndMs: Math.round(n.responseEnd),
        images: performance
          .getEntriesByType("resource")
          .filter((r) => r.initiatorType === "img").length,
        scripts: performance
          .getEntriesByType("resource")
          .filter((r) => r.initiatorType === "script").length,
        workspaceRequests: performance
          .getEntriesByType("resource")
          .filter((r) => r.name.includes("/api/v1/workspace")).length,
      };
    });
    console.log(
      JSON.stringify({
        route,
        ...nav,
        databaseQueries: Object.entries(queries)
          .filter(([p]) => p.startsWith("/rest/"))
          .reduce((n, [, c]) => n + c, 0),
        authQueries: Object.entries(queries)
          .filter(([p]) => p.startsWith("/auth/"))
          .reduce((n, [, c]) => n + c, 0),
        queries,
      }),
    );
  }
  if (development && !browserDiagnostics)
    throw new Error("Development browser diagnostics were not observed.");
} catch (e) {
  console.error(output);
  throw e;
} finally {
  await browser?.close();
  app.kill("SIGTERM");
  server.closeAllConnections();
  await new Promise((r) => server.close(r));
}
