"use client";
import { useRef, useState } from "react";
export function PrivateAudio({
  fileId,
  title,
}: {
  fileId: string;
  title: string;
}) {
  const [revision, setRevision] = useState(0),
    [failed, setFailed] = useState(false);
  const audio = useRef<HTMLAudioElement>(null),
    position = useRef(0);
  return (
    <div>
      <audio
        ref={audio}
        controls
        preload="metadata"
        src={`/api/v1/files/${fileId}?v=${revision}`}
        aria-label={`Play ${title}`}
        onError={() => setFailed(true)}
        onLoadedMetadata={() => {
          if (
            audio.current &&
            position.current &&
            Number.isFinite(audio.current.duration)
          )
            audio.current.currentTime = Math.min(
              position.current,
              audio.current.duration,
            );
        }}
      />
      {failed && (
        <p role="status" className="help-line">
          Playback may have expired, or this browser may not support the
          original format.{" "}
          <button
            type="button"
            className="subtle-button"
            onClick={() => {
              position.current = audio.current?.currentTime || 0;
              setFailed(false);
              setRevision((n) => n + 1);
            }}
          >
            Refresh private playback
          </button>{" "}
          You can also download the original to listen on your device.
        </p>
      )}
    </div>
  );
}
