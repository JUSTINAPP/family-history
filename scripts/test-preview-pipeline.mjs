// Production-build integration against loopback-only synthetic Auth/Storage/PostgREST.
import { spawn } from "node:child_process";
import { fixtureServer } from "../tests/fixtures/visibility-server.mjs";
import { checkPreviewBundle } from "./check-preview-bundle.mjs";
import { readFile, readdir } from "node:fs/promises";
const env = {
  ...process.env,
  DOCUMENT_AI_PROVIDER: "",
  DOCUMENT_AI_MODEL: "",
  OPENAI_API_KEY: "fixture-server-document-key",
  ARCHIVE_DEMO_MODE: "false",
  ARCHIVE_BUILD_DIR: ".next-test",
  NEXT_PUBLIC_SUPABASE_URL: "http://127.0.0.1:4301",
  NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: "fixture-public-key",
};
async function command(args) {
  const child = spawn(process.execPath, args, { env, stdio: "inherit" });
  const code = await new Promise((resolve) => child.once("exit", resolve));
  if (code !== 0) throw new Error(`Preview test command failed (${code}).`);
}
if (!process.env.TEST_PREVIEW_SKIP_BUILD)
  await command(["node_modules/next/dist/bin/next", "build"]);
for (const name of await readdir(".next-test/static", {recursive:true})) {
  if(name.endsWith(".js") && (await readFile(`.next-test/static/${name}`,"utf8")).includes("fixture-server-document-key")) throw new Error("Server document key leaked into client bundle.");
}
console.log("Document server-key client-bundle exclusion passed.");
const previewFile = process.env.TEST_HEIC_FILE || "tests/fixtures/preview.heic";
await checkPreviewBundle(".next-test", await readFile(previewFile));
const { server } = await fixtureServer(4301, {
  previewFile,
  management: true,
});
const app = spawn(
  process.execPath,
  [
    "node_modules/next/dist/bin/next",
    "start",
    "--hostname",
    "127.0.0.1",
    "--port",
    "4300",
  ],
  { env, stdio: ["ignore", "pipe", "pipe"] },
);
let output = "";
for (const stream of [app.stdout, app.stderr])
  stream.on("data", (chunk) => {
    output = (output + chunk).slice(-12000);
  });
try {
  let ready = false;
  for (let i = 0; i < 100; i++) {
    if (app.exitCode !== null)
      throw new Error("Production test server exited. " + output);
    try {
      if ((await fetch("http://127.0.0.1:4300/sign-in")).ok) {
        ready = true;
        break;
      }
    } catch {}
    await new Promise((resolve) => setTimeout(resolve, 300));
  }
  if (!ready)
    throw new Error("Production test server did not start. " + output);
  await command([
    "node_modules/@playwright/test/cli.js",
    "test",
    "--config",
    "playwright.preview.config.ts",
  ]);
} catch (error) {
  process.stderr.write(output);
  throw error;
} finally {
  app.kill("SIGTERM");
  server.closeAllConnections();
  await new Promise((resolve) => server.close(resolve));
}
