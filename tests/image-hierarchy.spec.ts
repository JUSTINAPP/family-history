import { test, expect } from "@playwright/test";
import sharp from "sharp";
import { createHash } from "node:crypto";
import { convertPreview } from "../src/lib/preview/convert";
test("a large master produces independent Retina display, responsive thumbnails and a tiny real placeholder", async () => {
  const master = await sharp({
    create: { width: 3200, height: 2400, channels: 3, background: "#315b87" },
  })
    .jpeg({ quality: 96 })
    .toBuffer();
  const before = createHash("sha256").update(master).digest("hex");
  const result = await convertPreview(master);
  expect([result.width, result.height]).toEqual([2400, 1800]);
  expect([result.thumbnail.width, result.thumbnail.height]).toEqual([
    1200, 900,
  ]);
  expect([result.small.width, result.small.height]).toEqual([600, 450]);
  expect((await sharp(result.bytes).metadata()).format).toBe("jpeg");
  expect((await sharp(result.thumbnail.bytes).metadata()).format).toBe("webp");
  expect((await sharp(result.small.bytes).metadata()).format).toBe("webp");
  expect(result.thumbnail.bytes.length).toBeLessThan(result.bytes.length);
  expect(result.small.bytes.length).toBeLessThan(result.thumbnail.bytes.length);
  const placeholder = Buffer.from(result.placeholder.split(",")[1], "base64");
  expect((await sharp(placeholder).metadata()).width).toBe(24);
  expect(placeholder.length).toBeLessThan(1000);
  expect(createHash("sha256").update(master).digest("hex")).toBe(before);
  expect((await sharp(master).metadata()).width).toBe(3200);
});
test("portrait and panoramic photographs keep their orientation and aspect ratio without upscaling", async () => {
  for (const [width, height] of [
    [600, 900],
    [1800, 450],
  ]) {
    const source = await sharp({
      create: { width, height, channels: 3, background: "#426b91" },
    })
      .png()
      .toBuffer();
    const result = await convertPreview(source);
    for (const image of [result, result.thumbnail, result.small]) {
      expect(image.width).toBeLessThanOrEqual(width);
      expect(image.height).toBeLessThanOrEqual(height);
      expect(image.width / image.height).toBeCloseTo(width / height, 2);
    }
    expect([result.width, result.height]).toEqual([width, height]);
  }
});
