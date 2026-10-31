/* Local-only, disposable HEIC decoder. Original File bytes are never changed. */
importScripts("/codecs/libheif.js");
self.onmessage = async ({ data }) => {
  try {
    const codec = await libheif();
    await codec.ready;
    const decoder = new codec.HeifDecoder();
    const images = decoder.decode(new Uint8Array(data));
    try {
      const image = images.find((image) => image.is_primary()) || images[0];
      if (!image) throw Error("decode");
      const width = image.get_width(),
        height = image.get_height();
      if (width * height > 60000000) throw Error("pixel_limit");
      const pixels = await new Promise((resolve, reject) =>
        image.display(
          { width, height, data: new Uint8ClampedArray(width * height * 4) },
          (result) => (result ? resolve(result.data) : reject(Error("decode"))),
        ),
      );
      const canvas = new OffscreenCanvas(width, height);
      canvas
        .getContext("2d")
        .putImageData(new ImageData(pixels, width, height), 0, 0);
      const scale = Math.min(1, 1600 / Math.max(width, height));
      const resized = new OffscreenCanvas(
        Math.round(width * scale),
        Math.round(height * scale),
      );
      resized
        .getContext("2d")
        .drawImage(canvas, 0, 0, resized.width, resized.height);
      self.postMessage({
        blob: await resized.convertToBlob({
          type: "image/jpeg",
          quality: 0.85,
        }),
      });
    } finally {
      images.forEach((image) => image.free());
      decoder.decoder.delete();
    }
  } catch {
    self.postMessage({ error: true });
  }
};
