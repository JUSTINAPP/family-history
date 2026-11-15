import type { NextConfig } from "next";
const config: NextConfig = {
  poweredByHeader: false,
  serverExternalPackages: ["sharp", "libheif-js"],
  outputFileTracingIncludes: {
    "/api/v1/image-framing/*": ["./scripts/preview-worker.cjs", "./scripts/perspective.cjs", "./node_modules/libheif-js/**/*", "./node_modules/sharp/**/*", "./node_modules/@img/**/*", "./node_modules/detect-libc/**/*", "./node_modules/semver/**/*"],
    "/api/v1/previews/*": [
      "./scripts/preview-worker.cjs",
      "./scripts/perspective.cjs",
      "./node_modules/libheif-js/**/*",
      "./node_modules/sharp/**/*",
      "./node_modules/@img/**/*",
      "./node_modules/detect-libc/**/*",
      "./node_modules/semver/**/*",
    ],
  },
  distDir: process.env.ARCHIVE_BUILD_DIR || ".next",
  allowedDevOrigins: ["127.0.0.1"],
  // Keep visited pages in this browser's router cache during archive browsing.
  // Existing mutation refreshes/revalidation and sign-out invalidate this cache.
  // This does not cache private pages on a shared server or CDN.
  experimental: { proxyClientMaxBodySize: "90mb", staleTimes: { dynamic: 600, static: 600 } },
};
export default config;
