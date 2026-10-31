export const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
export const MAX_ORIGINAL_BYTES = 30 * 1024 * 1024;
export function imageMime(bytes: Uint8Array): string | null {
  if (bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff)
    return "image/jpeg";
  if ([137, 80, 78, 71, 13, 10, 26, 10].every((v, i) => bytes[i] === v))
    return "image/png";
  const text = (a: number, b: number) =>
    String.fromCharCode(...bytes.slice(a, b));
  if (text(0, 4) === "RIFF" && text(8, 12) === "WEBP") return "image/webp";
  if (text(4, 8) === "ftyp") {
    const major = text(8, 12);
    if (/^(heic|heix|hevc|hevx)$/.test(major)) return "image/heic";
    if (/^(mif1|msf1)$/.test(major)) return "image/heif";
  }
  return null;
}
