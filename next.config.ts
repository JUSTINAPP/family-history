import type { NextConfig } from "next";
const config: NextConfig = {
  poweredByHeader: false,
  distDir: process.env.ARCHIVE_BUILD_DIR || ".next",
  allowedDevOrigins: ["127.0.0.1"],
  experimental: { proxyClientMaxBodySize: "90mb" },
};
export default config;
