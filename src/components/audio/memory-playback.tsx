"use client";
import { useEffect, useRef, useState } from "react";
import { Play, Pause, LoaderCircle, RotateCcw } from "lucide-react";
const time = (seconds: number) => `${Math.floor(seconds / 60)}:${String(Math.floor(seconds % 60)).padStart(2, "0")}`;
export function MemoryPlayback({fileId, title, onPlaying}: {fileId: string; title: string; onPlaying: (playing: boolean) => void}) {
  const audio = useRef<HTMLAudioElement>(null);
  const [busy, setBusy] = useState(true), [playing, setPlaying] = useState(false), [error, setError] = useState("");
  const [position, setPosition] = useState(0), [duration, setDuration] = useState(0), [revision, setRevision] = useState(0);
  useEffect(() => {
    const element = audio.current;
    if (!element) return;
    void element.play().catch(e => {setBusy(false); setError(e.name === "NotAllowedError" ? "Tap Play to listen." : "Audio could not load. Try again.");});
    return () => { element.pause(); };
  }, [revision]);
  useEffect(() => {onPlaying(playing); return () => onPlaying(false);}, [playing, onPlaying]);
  async function play() {
    if (!audio.current) return;
    if (playing) {audio.current.pause();return;}
    setBusy(true);setError("");
    try {await audio.current.play();} catch {setBusy(false);setError("Audio could not play. Try again.");}
  }
  return <div className="memory-playback" aria-busy={busy}>
    <audio ref={audio} src={`/api/v1/files/${fileId}?v=${revision}`} preload="auto" aria-label={`Play ${title}`}
      onLoadStart={() => setBusy(true)} onWaiting={() => {setBusy(true);setPlaying(false);}} onStalled={() => setBusy(true)}
      onCanPlay={() => setBusy(false)} onPlaying={() => {setBusy(false);setPlaying(true);setError("");}}
      onPause={() => setPlaying(false)} onEnded={() => {setPlaying(false);setBusy(false);}}
      onError={() => {setBusy(false);setPlaying(false);setError("Audio could not load. Try again.");}}
      onTimeUpdate={e => setPosition(e.currentTarget.currentTime)} onLoadedMetadata={e => {if(Number.isFinite(e.currentTarget.duration))setDuration(e.currentTarget.duration);}} />
    <div className="memory-transport">
      <button type="button" className="memory-button memory-play" aria-label={playing ? "Pause memory" : "Play memory"} onClick={() => void play()}>{busy ? <LoaderCircle className="memory-spinner" aria-hidden="true" /> : playing ? <Pause aria-hidden="true" /> : <Play aria-hidden="true" />}{playing ? "Pause" : "Play"}</button>
      <label className="memory-seek"><span className="sr-only">Recording position</span><input type="range" min={0} max={duration || 1} step={.1} value={Math.min(position,duration || 1)} disabled={!duration} onChange={e => {if(audio.current)audio.current.currentTime=Number(e.target.value);setPosition(Number(e.target.value));}} /><span>{time(position)} / {time(duration)}</span></label>
      <button type="button" className="memory-button" aria-label="Retry audio" onClick={() => {setError("");setBusy(true);setRevision(v=>v+1);}}><RotateCcw size={18} aria-hidden="true" /></button>
    </div>
    <p className="memory-playback-status" role="status">{busy ? "Loading voice memory…" : error || (playing ? "Playing" : "Ready to listen")}</p>
  </div>;
}
