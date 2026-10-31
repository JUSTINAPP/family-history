"use client";
import { useEffect, useRef, useState } from "react";
const choices = [
  "audio/webm;codecs=opus",
  "audio/mp4",
  "audio/ogg;codecs=opus",
];
export function AudioRecorder({
  onChange,
  onBusy,
  disabled = false,
}: {
  onChange: (file: File | null, durationMs?: number) => void;
  onBusy: (busy: boolean) => void;
  disabled?: boolean;
}) {
  const [state, setState] = useState<
    "ready" | "requesting" | "recording" | "paused" | "stopped"
  >("ready");
  const [seconds, setSeconds] = useState(0);
  const [error, setError] = useState("");
  const recorder = useRef<MediaRecorder | null>(null),
    stream = useRef<MediaStream | null>(null),
    alive = useRef(true);
  const clock = useRef({ elapsed: 0, started: 0 });
  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
      if (recorder.current?.state !== "inactive") recorder.current?.stop();
      stream.current?.getTracks().forEach((t) => t.stop());
    };
  }, []);
  useEffect(() => {
    if (state !== "recording") return;
    const timer = setInterval(
      () =>
        setSeconds(
          Math.floor(
            (clock.current.elapsed +
              performance.now() -
              clock.current.started) /
              1000,
          ),
        ),
      250,
    );
    return () => clearInterval(timer);
  }, [state]);
  async function start() {
    if (
      !window.isSecureContext ||
      !navigator.mediaDevices?.getUserMedia ||
      typeof MediaRecorder === "undefined"
    ) {
      setError(
        "Microphone recording is unavailable here. Use HTTPS and a supported browser, or upload an existing recording.",
      );
      return;
    }
    setState("requesting");
    onBusy(true);
    setError("");
    onChange(null);
    try {
      const input = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: { ideal: false },
          noiseSuppression: { ideal: false },
          autoGainControl: { ideal: false },
        },
      });
      if (!alive.current) {
        input.getTracks().forEach((t) => t.stop());
        return;
      }
      stream.current = input;
      const mime = choices.find((type) => MediaRecorder.isTypeSupported(type));
      const next = new MediaRecorder(
        input,
        mime ? { mimeType: mime } : undefined,
      );
      recorder.current = next;
      const chunks: Blob[] = [];
      let bytes = 0;
      clock.current = { elapsed: 0, started: performance.now() };
      setSeconds(0);
      next.ondataavailable = (event) => {
        if (event.data.size) {
          chunks.push(event.data);
          bytes += event.data.size;
          if (bytes >= 29 * 1024 * 1024 && next.state !== "inactive") {
            setError(
              "Recording stopped near the 30 MB limit. Preview it before saving.",
            );
            next.stop();
          }
        }
      };
      next.onstop = () => {
        const elapsed =
          clock.current.elapsed +
          (clock.current.started
            ? performance.now() - clock.current.started
            : 0);
        input.getTracks().forEach((t) => t.stop());
        if (!alive.current) return;
        const type = next.mimeType || chunks[0]?.type || "audio/webm";
        const blob = new Blob(chunks, { type });
        const ext = type.includes("mp4")
          ? "m4a"
          : type.includes("ogg")
            ? "ogg"
            : "webm";
        if (blob.size)
          onChange(
            new File(
              [blob],
              `voice-${new Date().toISOString().replace(/[:.]/g, "-")}.${ext}`,
              { type },
            ),
            Math.round(elapsed),
          );
        else
          setError(
            "No audio was captured. Check the microphone and try again.",
          );
        setSeconds(Math.floor(elapsed / 1000));
        setState("stopped");
        onBusy(false);
      };
      next.onerror = () => {
        setError(
          "Recording was interrupted. Preview any captured audio, or start again.",
        );
        if (next.state !== "inactive") next.stop();
        input.getTracks().forEach((t) => t.stop());
        onBusy(false);
      };
      next.start(1000);
      setState("recording");
    } catch {
      stream.current?.getTracks().forEach((t) => t.stop());
      if (alive.current) {
        setState("ready");
        onBusy(false);
        setError(
          "Microphone access was not available. Allow microphone access and try again, or upload an audio file.",
        );
      }
    }
  }
  function pause() {
    const current = recorder.current;
    if (!current) return;
    try {
      if (current.state === "recording") {
        current.pause();
        clock.current.elapsed += performance.now() - clock.current.started;
        clock.current.started = 0;
        setState("paused");
      } else if (current.state === "paused") {
        current.resume();
        clock.current.started = performance.now();
        setState("recording");
      }
    } catch {
      setError(
        "Pause is unavailable in this browser. Stop to keep this recording.",
      );
    }
  }
  const active = state === "recording" || state === "paused";
  return (
    <section className="voice-panel" aria-label="Record a voice memory">
      <p className="eyebrow">YOUR VOICE, KEPT AS YOU RECORD IT</p>
      <p role="status">
        {state === "requesting"
          ? "Waiting for microphone permission…"
          : state === "recording"
            ? "Recording"
            : state === "paused"
              ? "Paused"
              : state === "stopped"
                ? "Ready to preview"
                : "Ready to record"}{" "}
        · {Math.floor(seconds / 60)}:{String(seconds % 60).padStart(2, "0")}
      </p>
      <div className="import-actions">
        {!active && (
          <button
            type="button"
            className="button"
            disabled={disabled || state === "requesting"}
            onClick={start}
          >
            {state === "stopped" ? "Record again" : "Record"}
          </button>
        )}
        {active && (
          <>
            <button type="button" className="subtle-button" onClick={pause}>
              {state === "paused" ? "Resume" : "Pause"}
            </button>
            <button
              type="button"
              className="button"
              onClick={() => recorder.current?.stop()}
            >
              Stop
            </button>
          </>
        )}
      </div>
      <p className="help-line">
        Nothing is uploaded until you choose Save. Keep this page open while
        recording.
      </p>
      {error && (
        <p role="alert" className="notice">
          {error}
        </p>
      )}
    </section>
  );
}
