"use client";
import { useEffect, useRef, useState } from "react";
import { Play, Pause, LoaderCircle } from "lucide-react";
export function MemoryPlayback({fileId, title, onPlaying, onEnded}: {fileId: string; title: string; onPlaying: (playing: boolean) => void; onEnded: () => void}) {
  const audio = useRef<HTMLAudioElement>(null);
  const [busy, setBusy] = useState(true), [playing, setPlaying] = useState(false), [error, setError] = useState("");
  const [revision, setRevision] = useState(0);
  useEffect(() => {
    const element = audio.current;
    if (!element) return;
    void element.play().catch(e => {setBusy(false); setError(e.name === "NotAllowedError" ? "Tap Play to listen." : "Audio could not load. Tap Play to retry.");});
    return () => {element.pause();};
  }, [revision]);
  useEffect(() => {onPlaying(playing); return () => onPlaying(false);}, [playing, onPlaying]);
  async function toggle() {
    const element=audio.current;if(!element)return;
    if(!element.paused){element.pause();setBusy(false);return;}
    if(element.error){setError("");setBusy(true);setRevision(v=>v+1);return;}
    setBusy(true);setError("");
    try {await element.play();} catch {setBusy(false);setError("Audio could not play. Tap Play to retry.");}
  }
  return <div className="cinema-playback" aria-busy={busy}>
    <audio ref={audio} src={`/api/v1/files/${fileId}?v=${revision}`} preload="auto" aria-label={`Play ${title}`}
      onLoadStart={()=>setBusy(true)} onWaiting={()=>{setBusy(true);setPlaying(false);}} onStalled={()=>setBusy(true)}
      onCanPlay={()=>setBusy(false)} onPlaying={()=>{setBusy(false);setPlaying(true);setError("");}}
      onPause={()=>setPlaying(false)} onEnded={()=>{setPlaying(false);setBusy(false);onEnded();}}
      onError={()=>{setBusy(false);setPlaying(false);setError("Audio could not load. Tap Play to retry.");}} />
    <button type="button" className="cinema-control" aria-label={playing ? "Pause memory" : "Play memory"} onClick={()=>void toggle()}>{busy ? <LoaderCircle className="memory-spinner" aria-hidden="true" /> : playing ? <Pause aria-hidden="true" /> : <Play aria-hidden="true" />}</button>
    {(busy || error) && <p className="cinema-status" role="status">{busy ? "Loading voice memory…" : error}</p>}
  </div>;
}
