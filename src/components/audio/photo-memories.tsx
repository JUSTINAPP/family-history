"use client";
import { useId, useState } from "react";
import { Mic, Headphones } from "lucide-react";
import { AudioCapture } from "./audio-capture";
import { PrivateAudio } from "./private-player";
import { useWorkspace } from "../workspace-provider";
import { can } from "@/lib/permissions";
import type { RecordingView } from "@/lib/audio/repository";
export function PhotoMemories({ itemId, title, recordings }: { itemId: string; title: string; recordings: RecordingView[] }) {
  const workspace = useWorkspace();
  const [record, setRecord] = useState(false), [listen, setListen] = useState(false), [saved, setSaved] = useState(false);
  const id = useId();
  return <div className="photo-memories">
    <div className="memory-actions">
      {can(workspace.role, "contributor") && <button type="button" className="memory-button" aria-expanded={record} aria-controls={`${id}-record`} onClick={() => { if (!record || window.confirm("Close the recorder? Any unsaved recording and details will be discarded.")) setRecord(!record); }}><Mic size={18} aria-hidden="true" />{record ? "Close recorder" : "Record a message"}</button>}
      {!!recordings.length && <button type="button" className="memory-button listen-badge" aria-label={`Listen to ${recordings.length} ${recordings.length === 1 ? "memory" : "memories"} about ${title}`} aria-expanded={listen} aria-controls={`${id}-listen`} onClick={() => setListen(!listen)}><Headphones size={18} aria-hidden="true" />Listen{recordings.length > 1 ? ` (${recordings.length})` : ""}</button>}
    </div>
    {saved && <p role="status">Your voice memory is saved with this photo.</p>}
    {listen && <section id={`${id}-listen`} className="memory-panel" aria-label={`Voice memories about ${title}`} onPlayCapture={e => { const current = e.target; e.currentTarget.querySelectorAll('audio').forEach(audio => { if (audio !== current) audio.pause(); }); }}>
      {recordings.map(r => { const speaker = r.metadata.speaker || workspace.historicalPeople.find(p => p.id === r.metadata.speakerPersonId)?.name;
        return <article key={r.id}><h3>{speaker ? `Listen to ${speaker} talk about this` : "Listen to this memory"}</h3><PrivateAudio fileId={r.fileId} title={speaker ? `${speaker}'s memory` : r.metadata.title || "Voice memory"} /></article>;
      })}
    </section>}
    <section id={`${id}-record`} hidden={!record} className="memory-panel" aria-label={`Record a memory about ${title}`}>
      {record && <><h3>Tell us about this photo</h3><p>The recording will stay with this photo. You can link one or more people below.</p><AudioCapture itemId={itemId} inline onSaved={() => {setSaved(true);setRecord(false);setListen(true);}} /></>}
    </section>
  </div>;
}
