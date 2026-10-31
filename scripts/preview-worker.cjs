/* eslint-disable @typescript-eslint/no-require-imports -- standalone CommonJS worker, traced unchanged for Node deployment. */
// Runs in a disposable Node worker: decoder work never blocks the request event loop.
const { parentPort, workerData } = require("node:worker_threads");
const sharp = require("sharp");
const codec = require("libheif-js/wasm-bundle");
(async () => {
  const source = Buffer.from(workerData);
  let pipeline;
  if (source.toString("ascii", 4, 8) === "ftyp") {
    await codec.ready;
    const decoder = new codec.HeifDecoder();
    const images = decoder.decode(source);
    try {
      const image = images.find((image) => image.is_primary()) || images[0];
      if (!image || image.get_width() * image.get_height() > 60000000)
        throw Error("pixel_limit");
      const decoded = await new Promise((resolve, reject) =>
        image.display(
          {
            width: image.get_width(),
            height: image.get_height(),
            data: new Uint8ClampedArray(
              image.get_width() * image.get_height() * 4,
            ),
          },
          (result) => (result ? resolve(result) : reject(Error("decode"))),
        ),
      );
      // libheif applies HEIF container rotation/mirroring during decode. Do not rotate twice.
      pipeline = sharp(Buffer.from(decoded.data), {
        raw: { width: decoded.width, height: decoded.height, channels: 4 },
        limitInputPixels: 60000000,
      });
    } finally {
      images.forEach((image) => image.free());
      decoder.decoder.delete();
    }
  } else {
    pipeline = sharp(source, { limitInputPixels: 60000000 }).autoOrient();
  }
  const result = await pipeline
    .resize({
      width: 2400,
      height: 2400,
      fit: "inside",
      withoutEnlargement: true,
    })
    .flatten({ background: "#ffffff" })
    .jpeg({ quality: 85, mozjpeg: false })
    .toBuffer({ resolveWithObject: true });
  parentPort.postMessage({
    bytes: result.data,
    width: result.info.width,
    height: result.info.height,
  });
})().catch(() => parentPort.postMessage({ error: "preview_failed" }));
