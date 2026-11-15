"use client";
import { useEffect, useId, useRef, useState } from "react";
import {useItemPages} from "../item-pages";
import { X, LoaderCircle, Play, Pause } from "lucide-react";
import {DocumentReadingPanel} from "../live/document-reading-panel";
import { ItemDetailsPanel } from "../live/item-details-panel";
import { MemoryPlayback } from "./memory-playback";
import { ArchiveImage } from "../archive-image";
import { useWorkspace } from "../workspace-provider";
import type { ArchiveItem } from "@/lib/types";
import type { RecordingView } from "@/lib/audio/repository";
export function MemoryViewer({item, recordings, initialMode, onClose}: {item: ArchiveItem; recordings: RecordingView[]; initialMode: "listen" | "record" | "edit"; onClose: () => void}) {
  const workspace = useWorkspace(), dialog = useRef<HTMLDialogElement>(null), id = useId();
  const savedPages=useItemPages(item,workspace.mode==="live" && initialMode!=="listen");
  const pageItem=savedPages.item;
  const [mode] = useState(initialMode), [selected, setSelected] = useState(recordings[0]?.id), [playing, setPlaying] = useState(false);
  const [imageReady, setImageReady] = useState(false), [imageFailed, setImageFailed] = useState(false), [still, setStill] = useState(false);
  const [reading,setReading]=useState(false);
  const [dirty, setDirty] = useState(false), [saving, setSaving] = useState(false);
  useEffect(() => {
    const element=dialog.current, focused=document.activeElement as HTMLElement | null, overflow=document.body.style.overflow;
    element?.showModal(); document.body.style.overflow="hidden";
    return () => {element?.close(); document.body.style.overflow=overflow; focused?.focus({preventScroll:true});};
  }, []);
  function mayLeave() {return !saving && (!dirty || window.confirm("Discard unsaved changes?"));}
  function close() {if(mayLeave())onClose();}

  const current=recordings.find(r=>r.id===selected) || recordings[0];
  const speaker=(r: RecordingView) => r.metadata.speaker || workspace.historicalPeople.find(p=>p.id===r.metadata.speakerPersonId)?.name || "Voice memory";
  return <dialog ref={dialog} className="memory-viewer" data-mode={mode === "listen" ? "listen" : "record"} aria-labelledby={`${id}-title`} onCancel={e=>{e.preventDefault();close();}}>
    <header className="memory-viewer-header"><h2 id={`${id}-title`}>{reading ? "Letter transcription" : mode === "listen" ? item.title : "Details & memories"}</h2><button type="button" className="memory-button" aria-label="Close photo" disabled={saving} onClick={close}><X aria-hidden="true" /></button></header>
    {reading ? <div className="memory-reading"><button className="subtle-button" disabled={saving} onClick={()=>{if(mayLeave()){setDirty(false);setReading(false);}}}>Back to details & memories</button><DocumentReadingPanel itemId={item.id} onDirtyChange={setDirty} onSavingChange={setSaving}/></div> : <div className="memory-viewer-body" data-mode={mode === "listen" ? "listen" : "record"}>
      <div className="memory-stage">
        {savedPages.navigation}
        <div className="memory-cinema" data-playing={mode==="listen" && (current ? playing : imageReady && !still)} onErrorCapture={()=>setImageFailed(true)}>
          <ArchiveImage key={pageItem.originalId||pageItem.image} src={pageItem.image} alt={item.title} imageSet={pageItem.imageSet} rotation={pageItem.rotation} variant="display" autoPrepare={false} priority fitFrame sizes="(max-width: 820px) 95vw, 70vw" onReady={()=>setImageReady(true)} />
        </div>
        {!imageReady && !imageFailed && <p className="memory-image-status" role="status"><LoaderCircle className="memory-spinner" aria-hidden="true" />Loading photo…</p>}
        {imageFailed && <p className="memory-image-status" role="status">Photo could not load. Close and reopen to retry.</p>}
        {mode==="listen" && !current && <button type="button" className="cinema-control cinema-photo-pause" aria-label={still ? "Play photo motion" : "Pause photo motion"} onClick={()=>setStill(!still)}>{still ? <Play aria-hidden="true" /> : <Pause aria-hidden="true" />}</button>}
      </div>
      <section className="memory-viewer-controls" aria-label={mode!=="listen" ? `Edit details and memories for ${item.title}` : `Voice memories about ${item.title}`}>
        {mode!=="listen" ? <ItemDetailsPanel item={item} startRecording={mode==="record"} onDirtyChange={setDirty} onSavingChange={setSaving} onTranscription={()=>{if(mayLeave()){setDirty(false);setReading(true);}}}/> : current ? <>
          <span className="cinema-announcement" aria-live="polite">{speaker(current)}</span>
          <MemoryPlayback key={current.id} fileId={current.fileId} title={`${speaker(current)}'s memory`} onPlaying={setPlaying} onEnded={()=>{const next=recordings[recordings.findIndex(r=>r.id===current.id)+1];if(next)setSelected(next.id);}} />
        </> : null}

      </section>
    </div>}
  </dialog>;
}
