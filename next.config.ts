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
  experimental: { proxyClientMaxBodySize: "90mb", staleTimes: { dynamic: 60, static: 180 } },
};
export default config;
