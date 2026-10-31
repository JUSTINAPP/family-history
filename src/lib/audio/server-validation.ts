import { parseBuffer } from "music-metadata";
import { BackendError } from "../backend/errors";
import { validateAudioBytes } from "./validation";
export async function inspectAudio(bytes: Uint8Array, mime: string) {
  validateAudioBytes(bytes, mime);
  try {
    const { format } = await parseBuffer(
      bytes,
      { mimeType: mime, size: bytes.length },
      { duration: true, skipCovers: true },
    );
    const audio =
      format.trackInfo.some((track) => track.type === 2 || !!track.audio) ||
      !!format.numberOfChannels;
    if (
      !audio ||
      format.trackInfo.some((track) => track.type === 1 || !!track.video)
    )
      throw new Error("not_audio");
    return format.duration && Number.isFinite(format.duration)
      ? Math.round(format.duration * 1000)
      : null;
  } catch {
    throw new BackendError(
      400,
      "This file could not be recognised as a supported audio recording. The original has not been changed.",
    );
  }
}
