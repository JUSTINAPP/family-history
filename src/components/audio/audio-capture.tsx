"use client";
import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { AudioRecorder } from "./recorder";
import { AudioMetadataFields } from "./metadata-fields";
import { useWorkspace } from "../workspace-provider";
import { browserSupabase } from "@/lib/supabase/client";
import { uploadAudio } from "@/lib/audio/upload";
import {
  AUDIO_ACCEPT,
  MAX_AUDIO_BYTES,
  emptyAudioMetadata,
} from "@/lib/audio/validation";
import { can } from "@/lib/permissions";
export function AudioCapture({ itemId, inline = false, onSaved, onDirtyChange, onSavingChange }: { itemId?: string; inline?: boolean; onSaved?: () => void; onDirtyChange?: (dirty: boolean) => void; onSavingChange?: (saving: boolean) => void }) {
  const workspace = useWorkspace(),
    router = useRouter();
  const [file, setFile] = useState<File | null>(null),
    [url, setUrl] = useState(""),
    [recording, setRecording] = useState(false),
    [saving, setSaving] = useState(false),
    [message, setMessage] = useState(""),
    [attempted, setAttempted] = useState(false);
  const [metadata, setMetadata] = useState(emptyAudioMetadata),
    [people, setPeople] = useState<string[]>([]),
    [items, setItems] = useState<string[]>([]),
    [key, setKey] = useState(0);
  const captureId = useRef("");
  useEffect(() => {onDirtyChange?.(!!file || recording || !!metadata.speaker || !!metadata.title || !!metadata.description || people.length > 0);}, [file, recording, metadata.speaker, metadata.title, metadata.description, people.length, onDirtyChange]);
  useEffect(() => {onSavingChange?.(saving);}, [saving, onSavingChange]);
  const mounted = useRef(true);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);
  useEffect(() => {
    if (!file) return;
    const next = URL.createObjectURL(file);
    let active = true;
    queueMicrotask(() => {
      if (active) setUrl(next);
    });
    return () => {
      active = false;
      URL.revokeObjectURL(next);
    };
  }, [file]);
  if (!can(workspace.role, "contributor"))
    return (
      <p className="notice">
        Contributor access is required to add a voice recording.
      </p>
    );
  function choose(next: File | null, durationMs?: number) {
    setAttempted(false);
    setFile(next);
    captureId.current = crypto.randomUUID();
    setMetadata((old) => ({
      ...old,
      durationMs,
      ...(next && durationMs !== undefined && !old.recordedDate
        ? {
            recordedDate: new Intl.DateTimeFormat("en-CA").format(new Date()),
            precision: "exact",
          }
        : {}),
    }));
    setMessage("");
  }
  async function save() {
    if (!file || saving || recording) return;
    setAttempted(true);
    setSaving(true);
    setMessage("Preserving original audio…");
    try {
      const result = await uploadAudio(browserSupabase(), {
        archiveId: workspace.archive.id,
        captureId: captureId.current,
        itemId,
        file,
        metadata,
        people,
        items,
      });
      setMessage("Voice recording preserved.");
      setFile(null);
      setKey((k) => k + 1);
      captureId.current = crypto.randomUUID();
      if (inline) onSaved?.();
      else router.push(`/archive/${result.itemId}`);
      router.refresh();
    } catch (error) {
      if (mounted.current)
        setMessage(
          error instanceof Error
            ? error.message
            : "Audio could not finish saving. Keep this page open and retry.",
        );
    } finally {
      if (mounted.current) setSaving(false);
    }
  }
  return (
    <div className="catalogue-form audio-capture">
      <AudioRecorder
        key={key}
        disabled={saving}
        onBusy={setRecording}
        onChange={choose}
      />
      <label className="field">
        <span>Or upload an existing recording</span>
        <input
          aria-label="Upload audio recording"
          type="file"
          accept={AUDIO_ACCEPT}
          disabled={recording || saving}
          onChange={(e) => {
            const selected = e.target.files?.[0];
            if (selected) {
              if (!selected.size || selected.size > MAX_AUDIO_BYTES)
                setMessage("Choose an audio file up to 30 MB.");
              else choose(selected);
            }
            e.target.value = "";
          }}
        />
      </label>
      <p className="help-line">
        M4A, MP3, WAV, WebM or Ogg · up to 30 MB. Your original is kept
        unchanged.
      </p>
      {file && !recording && (
        <section className="audio-preview">
          <p>
            {file.name} · {Math.round(file.size / 1024)} KB
          </p>
          <audio
            key={url}
            controls
            preload="metadata"
            src={url}
            aria-label="Preview selected audio"
            onLoadedMetadata={(event) => {
              const duration = event.currentTarget.duration;
              if (Number.isFinite(duration))
                setMetadata((old) => ({
                  ...old,
                  durationMs: Math.round(duration * 1000),
                }));
            }}
          />
          <div className="import-actions">
            <a href={url} download={file.name} className="text-link">
              Keep a local copy ↗
            </a>
            <button
              type="button"
              className="subtle-button"
              disabled={saving}
              onClick={() => {
                choose(null);
                setKey((k) => k + 1);
              }}
            >
              Delete / start again
            </button>
          </div>
        </section>
      )}
      <AudioMetadataFields
        memory={inline}
        value={metadata}
        onChange={setMetadata}
        people={workspace.historicalPeople}
        items={workspace.catalogue.filter((i) => i.id !== itemId)}
        relatedPeople={people}
        relatedItems={items}
        onPeople={setPeople}
        onItems={setItems}
        disabled={saving || attempted}
      />
      {workspace.mode === "demo" ? (
        <p className="notice">
          Local recording preview only in demo mode. Sign in to the live archive
          to save audio.
        </p>
      ) : (
        <button
          type="button"
          className="button"
          disabled={!file || recording || saving}
          onClick={save}
        >
          {saving
            ? "Saving original audio…"
            : itemId
              ? "Save voice recollection"
              : "Save voice recording"}
        </button>
      )}
      {message && (
        <p role="status" className="notice">
          {message}
        </p>
      )}
    </div>
  );
}
