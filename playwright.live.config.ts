import { defineConfig } from "@playwright/test";
import base from "./playwright.config";
export default defineConfig({
  ...base,
  testMatch: "**/live-auth.spec.ts",
  testIgnore: [],
  use: {
    ...base.use,
    baseURL: process.env.LIVE_TEST_BASE_URL || "http://localhost:4000",
  },
});
