"use client";
import { PrivateAudio } from "./private-player";
import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useWorkspace } from "../workspace-provider";
import { AudioMetadataFields } from "./metadata-fields";
import type { RecordingView } from "@/lib/audio/repository";
import { editAudioAction, archiveAudioAction } from "@/lib/audio/actions";
import { can } from "@/lib/permissions";
export function RecordingEditor({ recording }: { recording: RecordingView }) {
  const workspace = useWorkspace(),
    router = useRouter();
  const [metadata, setMetadata] = useState(recording.metadata),
    [people, setPeople] = useState(recording.people),
    [items, setItems] = useState(recording.items),
    [message, setMessage] = useState(""),
    [busy, setBusy] = useState(false);
  async function save(archive = false) {
    setBusy(true);
    setMessage("");
    try {
      const error = archive
        ? await archiveAudioAction(recording.id, !recording.archived)
        : await editAudioAction(recording.id, metadata, people, items);
      setMessage(error || "Recording details saved. Original audio unchanged.");
      if (!error) router.refresh();
    } catch {
      setMessage(
        "Changes could not be confirmed. Check your connection, then retry.",
      );
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="catalogue-form">
      <PrivateAudio
        fileId={recording.fileId}
        title={recording.metadata.title}
      />
      <AudioMetadataFields
        value={metadata}
        onChange={setMetadata}
        people={workspace.historicalPeople}
        items={workspace.catalogue.filter((i) => i.id !== recording.itemId)}
        relatedPeople={people}
        relatedItems={items}
        onPeople={setPeople}
        onItems={setItems}
        disabled={busy}
      />
      <div className="import-actions">
        <button className="button" disabled={busy} onClick={() => save()}>
          Save recording details
        </button>
        {can(workspace.role, "editor") && (
          <button
            className="subtle-button"
            disabled={busy}
            onClick={() => save(true)}
          >
            {recording.archived ? "Restore recording" : "Archive recording"}
          </button>
        )}
        <Link href={`/archive/${recording.itemId}`} className="text-link">
          Back to item ↗
        </Link>
      </div>
      <p className="help-line">
        Archiving retains the original and provenance. Editors can restore it
        here. Earlier written recollections remain unchanged.
      </p>
      {message && (
        <p role="status" className="notice">
          {message}
        </p>
      )}
    </div>
  );
}
