import { defineConfig } from "@playwright/test";
import base from "./playwright.config";
export default defineConfig({
  ...base,
  testMatch: "**/visibility-browser.spec.ts",
  testIgnore: [],
  workers: 1,
  use: { ...base.use, baseURL: "http://127.0.0.1:4300" },
});
