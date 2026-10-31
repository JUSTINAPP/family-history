"use client";
import { useEffect, useRef, useState } from "react";
import {
  Mic,
  Pause,
  Play,
  Square,
  RotateCcw,
  Check,
  LoaderCircle,
} from "lucide-react";
import { sampleRecollection } from "@/lib/demo-workspace";
export interface VoiceValue {
  audioSource?: string;
  machineTranscript: string;
  editedTranscript: string | null;
  recordedAt?: string;
}
type VoiceState =
  "ready" | "recording" | "paused" | "recorded" | "transcribing" | "transcript";
export function VoiceRecollection({
  onChange,
}: {
  onChange: (value: VoiceValue) => void;
}) {
  const [state, setState] = useState<VoiceState>("ready");
  const [seconds, setSeconds] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [edited, setEdited] = useState(sampleRecollection);
  const [editing, setEditing] = useState(false);
  const recordedAt = useRef("");
  const audio = useRef<HTMLAudioElement>(null);
  useEffect(() => {
    if (state !== "recording") return;
    const t = setInterval(() => setSeconds((s) => s + 1), 1000);
    return () => clearInterval(t);
  }, [state]);
  useEffect(() => {
    if (state !== "transcribing") return;
    const t = setTimeout(() => {
      setState("transcript");
      onChange({
        audioSource: "/audio/example-recollection.wav",
        machineTranscript: sampleRecollection,
        editedTranscript: null,
        recordedAt: recordedAt.current,
      });
    }, 1000);
    return () => clearTimeout(t);
  }, [state, onChange]);
  function start() {
    audio.current?.pause();
    setPlaying(false);
    recordedAt.current = new Date().toISOString();
    setState("recording");
    setSeconds(0);
    setEditing(false);
    setEdited(sampleRecollection);
    onChange({ machineTranscript: "", editedTranscript: null });
  }
  function stop() {
    setState("recorded");
    onChange({
      audioSource: "/audio/example-recollection.wav",
      machineTranscript: "",
      editedTranscript: null,
      recordedAt: recordedAt.current,
    });
  }
  const labels = {
    ready: "Ready to record",
    recording: "Recording",
    paused: "Paused",
    recorded: "Recorded",
    transcribing: "Transcribing",
    transcript: "Transcript ready",
  };
  return (
    <section
      className={`voice-panel voice-${state}`}
      aria-label="Voice recollection"
    >
      <div className="voice-top">
        <span className="eyebrow">YOUR VOICE, PART OF THE STORY</span>
        <span className="status-tag" role="status">
          {labels[state]}
        </span>
      </div>
      <div className="voice-invitation">
        <Mic size={29} strokeWidth={1.2} />
        <div>
          <h3>
            {state === "ready"
              ? "Tell it in your own words."
              : state === "recording"
                ? "Take your time."
                : state === "paused"
                  ? "A moment to remember."
                  : state === "transcribing"
                    ? "Putting the words on the page."
                    : "A memory, in your voice."}
          </h3>
          <p>
            {state === "ready"
              ? "A name, a place, a little memory. That’s enough."
              : state === "recording"
                ? "You can pause whenever you like."
                : state === "paused"
                  ? "Continue when you’re ready, or finish here."
                  : "The audio stays with the recollection, even after transcription."}
          </p>
        </div>
      </div>
      {(state === "recording" || state === "paused") && (
        <div className="voice-meter">
          <span className={state === "recording" ? "recording-dot" : ""} />
          <span>
            {Math.floor(seconds / 60)}:{String(seconds % 60).padStart(2, "0")}
          </span>
          <div className="waveform" aria-hidden="true">
            {[
              9, 20, 14, 29, 19, 35, 12, 26, 17, 32, 14, 24, 11, 28, 19, 35, 15,
              22,
            ].map((h, i) => (
              <i key={i} style={{ height: h }} />
            ))}
          </div>
        </div>
      )}
      <div className="voice-actions">
        {state === "ready" && (
          <button
            type="button"
            className="button record-button"
            onClick={start}
          >
            <Mic size={19} />
            Record
          </button>
        )}
        {state === "recording" && (
          <>
            <button
              type="button"
              className="button button-light"
              onClick={() => setState("paused")}
            >
              <Pause size={19} />
              Pause
            </button>
            <button type="button" className="button" onClick={stop}>
              <Square size={16} />
              Finish recording
            </button>
          </>
        )}
        {state === "paused" && (
          <>
            <button
              type="button"
              className="button"
              onClick={() => setState("recording")}
            >
              <Mic size={18} />
              Continue recording
            </button>
            <button
              type="button"
              className="button button-light"
              onClick={stop}
            >
              <Square size={16} />
              Finish recording
            </button>
          </>
        )}
        {["recorded", "transcript", "transcribing"].includes(state) && (
          <>
            <button
              type="button"
              className="button button-light"
              onClick={() => {
                if (playing) {
                  audio.current?.pause();
                  setPlaying(false);
                } else
                  audio.current
                    ?.play()
                    .then(() => setPlaying(true))
                    .catch(() => setPlaying(false));
              }}
            >
              {playing ? <Pause size={18} /> : <Play size={18} />}{" "}
              {playing ? "Pause playback" : "Play recording"}
            </button>
            <button type="button" className="subtle-button" onClick={start}>
              <RotateCcw size={16} />
              Re-record
            </button>
          </>
        )}
        {state === "recorded" && (
          <button
            type="button"
            className="button"
            onClick={() => setState("transcribing")}
          >
            Make a transcript
          </button>
        )}
      </div>
      <audio
        ref={audio}
        src="/audio/example-recollection.wav"
        preload="none"
        onEnded={() => setPlaying(false)}
        aria-label="Example recollection recording"
      />
      {state === "transcribing" && (
        <p className="voice-feedback" role="status">
          <LoaderCircle size={16} className="spin" />
          Preparing the example transcript… You can save without waiting.
        </p>
      )}
      {state === "transcript" && (
        <div className="voice-transcript">
          <div className="voice-top">
            <span className="eyebrow">
              {editing ? "YOUR EDITED TRANSCRIPT" : "MACHINE TRANSCRIPT · DEMO"}
            </span>
            <button
              type="button"
              className="subtle-button"
              onClick={() => {
                setEditing(!editing);
              }}
            >
              {editing ? "Close editor" : "Edit transcript"}
            </button>
          </div>
          {editing ? (
            <label className="field">
              <span className="sr-only">Edit recollection transcript</span>
              <textarea
                value={edited}
                onChange={(e) => {
                  setEdited(e.target.value);
                  onChange({
                    audioSource: "/audio/example-recollection.wav",
                    machineTranscript: sampleRecollection,
                    editedTranscript: e.target.value,
                    recordedAt: recordedAt.current,
                  });
                }}
              />
            </label>
          ) : (
            <p>{edited}</p>
          )}
          <p className="help-line">
            <Check size={13} /> Original audio and machine words are kept
            separately from your edits.
          </p>
        </div>
      )}
      <p className="voice-demo-note">
        Voice demo · uses a spoken example. Your microphone is off. No audio is
        uploaded or sent for transcription.
      </p>
    </section>
  );
}
