"use client";
import {useEffect,useRef,useState,type ReactNode} from 'react';
import {Headphones,LoaderCircle,Pause,Play,X} from 'lucide-react';
import {ArchiveImage} from '../archive-image';
import type {ArchiveItem} from '@/lib/types';
import type {RecordingView} from '@/lib/audio/repository';

/** The same audio element survives expansion, so listening never starts over. */
export function FeedMemory({item,recordings,active,onActivate,onStop,onDetails,children}:{item:ArchiveItem;recordings:RecordingView[];active:boolean;onActivate:()=>void;onStop:()=>void;onDetails:()=>void;children:ReactNode}) {
 const audio=useRef<HTMLAudioElement>(null),dialog=useRef<HTMLDialogElement>(null);
 const [expanded,setExpanded]=useState(false),[playing,setPlaying]=useState(false),[busy,setBusy]=useState(false),[error,setError]=useState(''),[index,setIndex]=useState(0);
 const current=recordings[index]||recordings[0];
 useEffect(()=>{if(!active)queueMicrotask(()=>{setExpanded(false);setPlaying(false);setBusy(false);});},[active]);
 useEffect(()=>{const element=audio.current;if(!active||!element)return;void element.play().catch(()=>{setBusy(false);setError('Tap Play to listen.');});return()=>element.pause();},[active,index]);
 useEffect(()=>{if(!expanded)return;const el=dialog.current,focus=document.activeElement as HTMLElement,overflow=document.body.style.overflow;el?.showModal();document.body.style.overflow='hidden';return()=>{el?.close();document.body.style.overflow=overflow;focus?.focus({preventScroll:true});};},[expanded]);
 async function toggle(){const el=audio.current;if(!el)return;if(!el.paused){el.pause();return;}setBusy(true);setError('');if(el.error)el.load();try{await el.play();}catch{setBusy(false);setError('Unable to play. Tap Play to retry.');}}
 function tap(){if(active){setExpanded(true);}else{setBusy(true);setError('');onActivate();}}
 function close(){setExpanded(false);onStop();}
 const control=<button type="button" className="feed-memory-control" aria-label={playing?'Pause memory':'Play memory'} onClick={()=>void toggle()}>{busy?<LoaderCircle className="memory-spinner"/>:playing?<Pause/>:<Play/>}</button>;
 return <>
  <div className="feed-memory-image" data-playing={active&&playing}>{children}</div>
  <button type="button" className="feed-image-open" aria-label={active?`Expand memory: ${item.title}`:`Listen to memory: ${item.title}`} onClick={tap}/>
  <button type="button" className="feed-listen-icon" aria-label={active?'Expand playing memory':`Listen to ${recordings.length} memories`} onClick={tap}>{active&&busy?<LoaderCircle className="memory-spinner"/>:<Headphones/>}</button>
  {active&&<>
   <audio ref={audio} src={`/api/v1/files/${current.fileId}`} preload="auto" onLoadStart={()=>setBusy(true)} onWaiting={()=>{setBusy(true);setPlaying(false);}} onPlaying={()=>{setBusy(false);setPlaying(true);setError('');}} onPause={()=>setPlaying(false)} onCanPlay={()=>setBusy(false)} onError={()=>{setBusy(false);setPlaying(false);setError('Unable to load. Tap Play to retry.');}} onEnded={()=>{setPlaying(false);if(index+1<recordings.length)setIndex(index+1);}}/>
   {!expanded&&control}
   {error&&!expanded&&<span className="feed-memory-error" role="status">{error}</span>}
   {expanded&&<dialog ref={dialog} className="feed-memory-expanded" aria-label={`Listen: ${item.title}`} onCancel={e=>{e.preventDefault();close();}}>
    <div className="feed-memory-stage" data-playing={playing}><ArchiveImage src={item.image} imageSet={item.imageSet} rotation={item.rotation} variant="display" priority alt={item.title} fitFrame/></div>
    <button className="feed-memory-details" onClick={()=>{setExpanded(false);onDetails();}}>Photo details</button>
    <button className="feed-memory-close" aria-label="Close memory" onClick={close}><X/></button>{control}
    {(busy||error)&&<span className="feed-memory-error" role="status">{busy?'Loading voice memory…':error}</span>}
   </dialog>}
  </>}
 </>;
}
