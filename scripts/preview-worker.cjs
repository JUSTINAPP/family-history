/* eslint-disable @typescript-eslint/no-require-imports -- standalone CommonJS worker, traced unchanged for Node deployment. */
// Runs in a disposable Node worker: decoder work never blocks the request event loop.
const { parentPort, workerData } = require("node:worker_threads");
const sharp = require("sharp");
const codec = require("libheif-js/wasm-bundle");
let stage = "decode";
(async () => {
  const source = Buffer.from(workerData.source);
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
  stage = "render";
  const result = await pipeline
    .clone()
    .resize({
      width: 2400,
      height: 2400,
      fit: "inside",
      withoutEnlargement: true,
    })
    .flatten({ background: "#ffffff" })
    .jpeg({ quality: 80, progressive: true, mozjpeg: false })
    .toBuffer({ resolveWithObject: true });
  if (result.data.length > 10 * 1024 * 1024) throw Error("display_size_limit");
  async function webp(edge, quality) {
    const output = await pipeline
      .clone()
      .resize({
        width: edge,
        height: edge,
        fit: "inside",
        withoutEnlargement: true,
      })
      .webp({ quality, effort: 3 })
      .toBuffer({ resolveWithObject: true });
    return {
      bytes: output.data,
      width: output.info.width,
      height: output.info.height,
    };
  }
  const thumbnail = await webp(1200, 74),
    small = await webp(600, 72),
    tiny = await webp(24, 30);
  parentPort.postMessage({
    bytes: result.data,
    width: result.info.width,
    height: result.info.height,
    thumbnail,
    small,
    placeholder: `data:image/webp;base64,${tiny.bytes.toString("base64")}`,
  });
})().catch((error) =>
  parentPort.postMessage({
    error: ["pixel_limit", "display_size_limit"].includes(error.message)
      ? error.message
      : `${stage}_failed`,
  }),
);
