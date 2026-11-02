"use client";
import Link from "next/link";
import { useEffect, useId, useRef, useState } from "react";
import { X, Mic, Headphones, LoaderCircle } from "lucide-react";
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
  return <dialog ref={dialog} className="memory-viewer" aria-labelledby={`${id}-title`} onCancel={e=>{e.preventDefault();close();}}>
    <header className="memory-viewer-header"><h2 id={`${id}-title`}>{item.title}</h2><button type="button" className="memory-button" aria-label="Close photo" disabled={saving} onClick={close}><X aria-hidden="true" /></button></header>
    <div className="memory-viewer-body" data-mode={mode}>
      <div className="memory-stage">
        <div className="memory-cinema" data-playing={playing && !still && mode==="listen"} onErrorCapture={()=>setImageFailed(true)}>
          <ArchiveImage src={item.image} alt={item.title} imageSet={item.imageSet} rotation={item.rotation} variant="display" autoPrepare={false} priority fitFrame sizes="(max-width: 820px) 95vw, 70vw" onReady={()=>setImageReady(true)} />
        </div>
        {!imageReady && !imageFailed && <p className="memory-image-status" role="status"><LoaderCircle className="memory-spinner" aria-hidden="true" />Loading photo…</p>}
        {imageFailed && <p className="memory-image-status" role="status">Photo could not load. Close and reopen to retry.</p>}
        {mode==="listen" && <button type="button" className="memory-motion" aria-pressed={still} onClick={()=>setStill(!still)}>{still ? "Enable photo motion" : "Keep photo still"}</button>}
      </div>
      <section className="memory-viewer-controls" aria-label={mode==="record" ? `Record a memory about ${item.title}` : `Voice memories about ${item.title}`}>
        <div className="memory-mode-actions"><button type="button" className="memory-button" aria-pressed={mode==="listen"} disabled={saving} onClick={()=>changeMode("listen")}><Headphones size={18} />Listen{recordings.length ? ` (${recordings.length})` : ""}</button>{can(workspace.role,"contributor") && <button type="button" className="memory-button" aria-pressed={mode==="record"} disabled={saving} onClick={()=>changeMode("record")}><Mic size={18} />Record a message</button>}</div>
        {saved && <p role="status">Your voice memory is saved with this photo.</p>}
        {mode==="record" ? <><h3>Tell us about this photo</h3><AudioCapture itemId={item.id} inline onDirtyChange={setDirty} onSavingChange={setSaving} onSaved={()=>{setDirty(false);setSaving(false);setSaved(true);setMode("listen");}} /></> : current ? <>
          <h3>{speaker(current)==="Voice memory" ? "Listen to this memory" : `Listen to ${speaker(current)} talk about this`}</h3>
          <MemoryPlayback key={current.id} fileId={current.fileId} title={`${speaker(current)}'s memory`} onPlaying={setPlaying} />
          {recordings.length>1 && <div className="memory-playlist" aria-label="Choose a voice memory">{recordings.map(r=><button key={r.id} type="button" className="memory-button" aria-pressed={r.id===current.id} onClick={()=>setSelected(r.id)}>{speaker(r)}</button>)}</div>}
        </> : <p>No voice memories yet. Record the first one about this photo.</p>}
        <Link className="memory-details-link" href={item.href!} onClick={e=>{if(!mayLeave())e.preventDefault();}}>Open photo details ↗</Link>
      </section>
    </div>
  </dialog>;
}
