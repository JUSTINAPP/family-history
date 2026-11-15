"use client";
import {playVoice,prepareVoicePlayback,releaseVoicePlayback} from "@/lib/audio/playback";
import {useEffect,useRef,useState,type ReactNode} from 'react';
import {Headphones,LoaderCircle,Pause,Play} from 'lucide-react';
import type {ArchiveItem} from '@/lib/types';
import type {RecordingView} from '@/lib/audio/repository';

/** Listening stays in the tile; the image opens the normal details viewer. */
export function FeedMemory({item,recordings,active,onActivate,onDetails,children}:{item:ArchiveItem;recordings:RecordingView[];active:boolean;onActivate:()=>void;onDetails:()=>void;children:ReactNode}) {
 const audio=useRef<HTMLAudioElement>(null);
 const [playing,setPlaying]=useState(false),[busy,setBusy]=useState(false),[error,setError]=useState(''),[index,setIndex]=useState(0);
 const current=recordings[index]||recordings[0];
 useEffect(()=>{if(!active)queueMicrotask(()=>{setPlaying(false);setBusy(false);});},[active]);
 useEffect(()=>{const element=audio.current;if(!active||!element)return;void playVoice(element).catch(()=>{setBusy(false);setError('Tap Play to listen.');});return()=>{element.pause();releaseVoicePlayback(element);};},[active,index]);
 async function toggle(){const el=audio.current;if(!el)return;if(!el.paused){el.pause();return;}setBusy(true);setError('');if(el.error)el.load();try{await playVoice(el);}catch{setBusy(false);setError('Unable to play. Tap Play to retry.');}}
 return <>
  <div className="feed-memory-image" data-playing={active&&playing}>{children}</div>
  <button type="button" className="feed-image-open" aria-label={`View ${item.title}`} aria-haspopup="dialog" onClick={onDetails}/>
  <button type="button" className="feed-listen-icon" aria-label={active?(playing?'Pause memory':'Play memory'):`Listen to ${recordings.length} memories`} onClick={()=>{prepareVoicePlayback();if(active)void toggle();else{setBusy(true);setError('');onActivate();}}}>{busy?<LoaderCircle className="memory-spinner" aria-hidden="true"/>:active?(playing?<Pause aria-hidden="true"/>:<Play aria-hidden="true"/>):<Headphones aria-hidden="true"/>}</button>
  {active&&<>
   <audio crossOrigin="anonymous" ref={audio} src={`/api/v1/files/${current.fileId}`} preload="auto" onLoadStart={()=>setBusy(true)} onWaiting={()=>{setBusy(true);setPlaying(false);}} onPlaying={()=>{setBusy(false);setPlaying(true);setError('');}} onPause={()=>setPlaying(false)} onCanPlay={()=>setBusy(false)} onError={()=>{setBusy(false);setPlaying(false);setError('Unable to load. Tap Play to retry.');}} onEnded={()=>{setPlaying(false);if(index+1<recordings.length)setIndex(index+1);}}/>
   {error&&<span className="feed-memory-error" role="status">{error}</span>}
  </>}
 </>;
}
