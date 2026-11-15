import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";
export default defineConfig([
  ...nextVitals,
  ...nextTs,
  globalIgnores([
    ".next/**",
    ".next-test/**",
    "public/codecs/**",
    "public/face-models/**",
    "next-env.d.ts",
    "playwright-report/**",
    "test-results/**",
  ]),
]);
