import { spawn } from "node:child_process";
import { fixtureServer } from "../tests/fixtures/visibility-server.mjs";
const { server } = await fixtureServer();
const app = spawn(
  process.execPath,
  [
    "node_modules/next/dist/bin/next",
    "dev",
    "--hostname",
    "127.0.0.1",
    "--port",
    "4300",
  ],
  {
    env: {
      ...process.env,
      DOCUMENT_AI_PROVIDER: "",
      DOCUMENT_AI_MODEL: "",
      OPENAI_API_KEY: "fixture-server-document-key",
      ARCHIVE_DEMO_MODE: "false",
      ARCHIVE_BUILD_DIR: ".next-test",
      NEXT_PUBLIC_SUPABASE_URL: "http://127.0.0.1:4301",
      NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: "fixture-public-key",
    },
    stdio: ["ignore", "pipe", "pipe"],
  },
);
let output = "";
app.stdout.on("data", (chunk) => {
  output = (output + chunk).slice(-5000);
});
app.stderr.on("data", (chunk) => {
  output = (output + chunk).slice(-5000);
});
try {
  let ready = false;
  for (let i = 0; i < 120; i++) {
    try {
      const response = await fetch("http://127.0.0.1:4300/sign-in");
      if (response.ok) {
        ready = true;
        break;
      }
    } catch {}
    await new Promise((resolve) => setTimeout(resolve, 500));
  }
  if (!ready) throw new Error("Local visibility app did not start. " + output);
  const test = spawn(
    process.execPath,
    [
      "node_modules/@playwright/test/cli.js",
      "test",
      "--config",
      "playwright.visibility.config.ts",
    ],
    { stdio: "inherit", env: process.env },
  );
  const status = await new Promise((resolve) =>
    test.once("exit", (code) => resolve(code || 0)),
  );
  process.exitCode = status;
  if (status) process.stderr.write(output);
} finally {
  app.kill("SIGTERM");
  server.closeAllConnections();
  await new Promise((resolve) => server.close(resolve));
}
