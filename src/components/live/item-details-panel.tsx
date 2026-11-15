"use client";
import {useEffect, useRef, useState} from "react";
import {LoaderCircle} from "lucide-react";
import {loadCardDetails} from "@/lib/backend/card-details-action";
import type {ArchiveItem} from "@/lib/types";
import {can} from "@/lib/permissions";
import {useWorkspace} from "../workspace-provider";
import {ItemEditor} from "./item-editor";
import {IdentificationForm} from "./identification-form";
import {PlacePicker} from "./place-picker";
import {ImageOptions} from "./image-options";
import {AudioCapture} from "../audio/audio-capture";
import {PrivateAudio} from "../audio/private-player";

type Details=NonNullable<Awaited<ReturnType<typeof loadCardDetails>>["data"]>;
export function ItemDetailsPanel({item,startRecording=false,onDirtyChange,onSavingChange}:{item:ArchiveItem;startRecording?:boolean;onDirtyChange:(dirty:boolean)=>void;onSavingChange:(busy:boolean)=>void}) {
 const workspace=useWorkspace();
 const root=useRef<HTMLDivElement>(null);
 const [data,setData]=useState<Details|null>(null),[error,setError]=useState(""),[retry,setRetry]=useState(0);
 const [audioDirty,setAudioDirty]=useState(false),[detailsDirty,setDetailsDirty]=useState(false);
 const [audioBusy,setAudioBusy]=useState(false),[detailsBusy,setDetailsBusy]=useState(false);
 const [saved,setSaved]=useState(false);
 useEffect(()=>onDirtyChange(audioDirty||detailsDirty),[audioDirty,detailsDirty,onDirtyChange]);
 useEffect(()=>onSavingChange(audioBusy||detailsBusy),[audioBusy,detailsBusy,onSavingChange]);
 useEffect(()=>{
  let active=true;
  void loadCardDetails(workspace.archive.id,item.id).then(result=>{if(!active)return;if(result.data){setData(result.data);setError("");}else setError(result.error||"Details unavailable.");}).catch(()=>{if(active)setError("Could not load details. Please retry.");});
  return()=>{active=false;};
 },[item,workspace.archive.id,retry]);
 const audio=<section className="unified-section" aria-label="Recordings">
  <h3>Recordings</h3><p>Add a voice memory or choose an existing audio file. Name the speaker below.</p>
  {data?.recordingsError&&<p role="status">{data.recordingsError} <button className="subtle-button" onClick={()=>setRetry(n=>n+1)}>Retry recordings</button></p>}
  {saved&&<p role="status">Recording saved with this item.</p>}
  {can(workspace.role,"contributor")&&<AudioCapture itemId={item.id} inline startImmediately={startRecording} onDirtyChange={setAudioDirty} onSavingChange={setAudioBusy} onSaved={()=>{setAudioDirty(false);setSaved(true);setRetry(n=>n+1);}}/>}
  {!!data?.recordings.length&&<details><summary>Listen to saved recordings ({data.recordings.length})</summary>{data.recordings.map(recording=><div key={recording.id}><p>{recording.metadata.speaker||recording.metadata.title||"Voice memory"}</p><PrivateAudio fileId={recording.fileId} title={recording.metadata.title}/></div>)}</details>}
 </section>;
 return <div className="unified-item-editor" ref={root}>
  <nav className="editor-section-nav" aria-label="Editor sections">{["Item details","People and places","Recordings","Image adjustments"].map(label=><button type="button" className="subtle-button" key={label} onClick={()=>{const section=Array.from(root.current?.querySelectorAll("section")||[]).find(el=>el.getAttribute("aria-label")===label);section?.scrollIntoView({block:"start",behavior:"smooth"});}}>{label}</button>)}</nav>
  <p className="help-line">Save details and recordings in their own sections. </p>
  {startRecording&&audio}
  {!data&&!error&&<p role="status"><LoaderCircle className="memory-spinner" size={18}/> Loading item details…</p>}
  {error&&<p role="alert">{error} <button className="subtle-button" onClick={()=>setRetry(n=>n+1)}>Retry</button></p>}
  {data&&<>
   <section className="unified-section" aria-label="Item details"><h3>Item details</h3>
    {data.editable?<ItemEditor item={data.editorItem} embedded onSaved={()=>setRetry(n=>n+1)} onDirtyChange={setDetailsDirty} onSavingChange={setDetailsBusy}/>:<p>{data.item.title} · {data.item.date}. You can contribute memories and suggest people; editing catalogue details requires permission.</p>}
   </section>
   <section className="unified-section" aria-label="People and places"><h3>{data.item.kind==="Artwork"?"Artist & people":"People & places"}</h3>
    {data.item.kind==="Artwork"&&<p>Save the artist name in Item details. Link or create their People record here so this artwork appears on their page. Other people shown in the artwork can be linked too.</p>}
    <IdentificationForm archiveId={workspace.archive.id} itemId={item.id} people={data.people} identifications={data.identifications} role={data.role} profileId={data.profileId} canCreate={data.editable} unavailable={!!error} simple/>
    <PlacePicker archiveId={workspace.archive.id} itemId={item.id} places={data.places} links={data.links} reportedText={data.editorItem.reported_place||""} editable={data.editable&&!error} editor={can(data.role,"editor")} profileId={data.profileId} simple/>
   </section>
  </>}
  {!startRecording&&audio}
  {data?.editable&&<section className="unified-section" aria-label="Image adjustments"><h3>Image adjustments</h3><p>Rotate, straighten or crop. The original stays preserved.</p>{data.sources.map((source,index)=><div key={source.id}>{data.sources.length>1&&<p>Image {index+1}</p>}<ImageOptions sourceId={source.id} rotation={source.presentation_rotation||0} editable={!error}/></div>)}</section>}
 </div>;
}
