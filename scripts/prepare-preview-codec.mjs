import { mkdir, copyFile } from "node:fs/promises";
await mkdir("public/codecs", { recursive: true });
await copyFile(
  "node_modules/libheif-js/libheif-wasm/libheif-bundle.js",
  "public/codecs/libheif.js",
);
await copyFile(
  "node_modules/libheif-js/libheif-wasm/LICENSE",
  "public/codecs/LICENSE.libheif",
);
