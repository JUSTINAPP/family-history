"use client";
import Link from "next/link";
import { useEffect, useId, useRef, useState } from "react";
import { X, Mic, Headphones, LoaderCircle, Play, Pause } from "lucide-react";
import { AudioCapture } from "./audio-capture";
import { MemoryPlayback } from "./memory-playback";
import { ArchiveImage } from "../archive-image";
import { useWorkspace } from "../workspace-provider";
import { can } from "@/lib/permissions";
import type { ArchiveItem } from "@/lib/types";
import type { RecordingView } from "@/lib/audio/repository";
export function MemoryViewer({item, recordings, initialMode, onClose}: {item: ArchiveItem; recordings: RecordingView[]; initialMode: "listen" | "record"; onClose: () => void}) {
  const workspace = useWorkspace(), dialog = useRef<HTMLDialogElement>(null), id = useId();
  const [mode, setMode] = useState(initialMode), [selected, setSelected] = useState(recordings[0]?.id), [playing, setPlaying] = useState(false);
  const [imageReady, setImageReady] = useState(false), [imageFailed, setImageFailed] = useState(false), [still, setStill] = useState(false), [saved, setSaved] = useState(false);
  const [dirty, setDirty] = useState(false), [saving, setSaving] = useState(false);
  useEffect(() => {
    const element=dialog.current, focused=document.activeElement as HTMLElement | null, overflow=document.body.style.overflow;
    element?.showModal(); document.body.style.overflow="hidden";
    return () => {element?.close(); document.body.style.overflow=overflow; focused?.focus({preventScroll:true});};
  }, []);
  function mayLeave() {return !saving && (!dirty || window.confirm("Discard this unsaved voice memory?"));}
  function close() {if(mayLeave())onClose();}
  function changeMode(next: "listen" | "record") {if(next===mode || !mayLeave())return;setDirty(false);setPlaying(false);setMode(next);}
  const current=recordings.find(r=>r.id===selected) || recordings[0];
  const speaker=(r: RecordingView) => r.metadata.speaker || workspace.historicalPeople.find(p=>p.id===r.metadata.speakerPersonId)?.name || "Voice memory";
  return <dialog ref={dialog} className="memory-viewer" data-mode={mode} aria-labelledby={`${id}-title`} onCancel={e=>{e.preventDefault();close();}}>
    <header className="memory-viewer-header"><h2 id={`${id}-title`}>{item.title}</h2><button type="button" className="memory-button" aria-label="Close photo" disabled={saving} onClick={close}><X aria-hidden="true" /></button></header>
    <div className="memory-viewer-body" data-mode={mode}>
      <div className="memory-stage">
        <div className="memory-cinema" data-playing={mode==="listen" && (current ? playing : imageReady && !still)} onErrorCapture={()=>setImageFailed(true)}>
          <ArchiveImage src={item.image} alt={item.title} imageSet={item.imageSet} rotation={item.rotation} variant="display" autoPrepare={false} priority fitFrame sizes="(max-width: 820px) 95vw, 70vw" onReady={()=>setImageReady(true)} />
        </div>
        {!imageReady && !imageFailed && <p className="memory-image-status" role="status"><LoaderCircle className="memory-spinner" aria-hidden="true" />Loading photo…</p>}
        {imageFailed && <p className="memory-image-status" role="status">Photo could not load. Close and reopen to retry.</p>}
        {mode==="listen" && !current && <button type="button" className="cinema-control cinema-photo-pause" aria-label={still ? "Play photo motion" : "Pause photo motion"} onClick={()=>setStill(!still)}>{still ? <Play aria-hidden="true" /> : <Pause aria-hidden="true" />}</button>}
      </div>
      <section className="memory-viewer-controls" aria-label={mode==="record" ? `Record a memory about ${item.title}` : `Voice memories about ${item.title}`}>
        {mode==="record" && <div className="memory-mode-actions"><button type="button" className="memory-button" disabled={saving} onClick={()=>changeMode("listen")}><Headphones size={18} />Listen{recordings.length ? ` (${recordings.length})` : ""}</button>{can(workspace.role,"contributor") && <button type="button" className="memory-button" aria-pressed="true" disabled={saving}><Mic size={18} />Record a message</button>}</div>}
        {saved && <p className={mode==="listen" ? "cinema-announcement" : undefined} role="status">Your voice memory is saved with this photo.</p>}
        {mode==="record" ? <><h3>Tell us about this photo</h3><AudioCapture itemId={item.id} inline onDirtyChange={setDirty} onSavingChange={setSaving} onSaved={()=>{setDirty(false);setSaving(false);setSaved(true);setMode("listen");}} /></> : current ? <>
          <span className="cinema-announcement" aria-live="polite">{speaker(current)}</span>
          <MemoryPlayback key={current.id} fileId={current.fileId} title={`${speaker(current)}'s memory`} onPlaying={setPlaying} onEnded={()=>{const next=recordings[recordings.findIndex(r=>r.id===current.id)+1];if(next)setSelected(next.id);}} />
        </> : null}
        {mode==="record" && <Link className="memory-details-link" href={item.href!} onClick={e=>{if(!mayLeave())e.preventDefault();}}>Open photo details ↗</Link>}
      </section>
    </div>
  </dialog>;
}
