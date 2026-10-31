import { BackendError } from "../backend/errors";
export const MAX_AUDIO_BYTES = 30 * 1024 * 1024;
export const AUDIO_ACCEPT = ".m4a,.mp3,.wav,.webm,.ogg,audio/*";
export function audioMime(bytes: Uint8Array): string | null {
  const text = (start: number, end: number) =>
    String.fromCharCode(...bytes.slice(start, end));
  if (text(0, 4) === "RIFF" && text(8, 12) === "WAVE") return "audio/wav";
  if (
    text(0, 3) === "ID3" ||
    (bytes[0] === 0xff && (bytes[1] & 0xe0) === 0xe0 && (bytes[1] & 6) !== 0)
  )
    return "audio/mpeg";
  if (text(4, 8) === "ftyp" && /M4A |isom|mp4[12]|M4B /.test(text(8, 40)))
    return "audio/mp4";
  if (text(0, 4) === "OggS") return "audio/ogg";
  if ([0x1a, 0x45, 0xdf, 0xa3].every((v, i) => bytes[i] === v))
    return "audio/webm";
  return null;
}
export function validateAudioBytes(bytes: Uint8Array, suppliedMime = "") {
  if (!bytes.length || bytes.length > MAX_AUDIO_BYTES)
    throw new BackendError(400, "Choose an audio file up to 30 MB.");
  const detected = audioMime(bytes);
  if (!detected)
    throw new BackendError(
      400,
      "Choose a valid M4A, MP3, WAV, Ogg or WebM audio file.",
    );
  const mime = suppliedMime.split(";")[0].toLowerCase();
  const aliases: Record<string, string> = {
    "audio/x-m4a": "audio/mp4",
    "audio/x-wav": "audio/wav",
  };
  if (
    mime &&
    mime !== "application/octet-stream" &&
    (aliases[mime] || mime) !== detected
  )
    throw new BackendError(
      400,
      "The audio format does not match its file type.",
    );
  return mime && mime !== "application/octet-stream" ? mime : detected;
}
export async function audioChecksum(bytes: Uint8Array<ArrayBuffer>) {
  return Array.from(
    new Uint8Array(await crypto.subtle.digest("SHA-256", bytes)),
    (b) => b.toString(16).padStart(2, "0"),
  ).join("");
}
export interface AudioMetadata {
  durationMs?: number;
  title: string;
  speaker: string;
  speakerPersonId: string;
  recordedDate: string;
  precision: string;
  location: string;
  description: string;
  tags: string[];
}
export const emptyAudioMetadata: AudioMetadata = {
  title: "",
  speaker: "",
  speakerPersonId: "",
  recordedDate: "",
  precision: "unknown",
  location: "",
  description: "",
  tags: [],
};
