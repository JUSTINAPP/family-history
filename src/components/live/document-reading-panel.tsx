"use client";
import {useEffect,useState} from "react";
import {LoaderCircle} from "lucide-react";
import {loadDocumentReading} from "@/lib/documents/reading-action";
import {DocumentReview} from "./document-review";
type Reading=NonNullable<Awaited<ReturnType<typeof loadDocumentReading>>["data"]>;
export function DocumentReadingPanel({itemId,onDirtyChange,onSavingChange}:{itemId:string;onDirtyChange:(dirty:boolean)=>void;onSavingChange:(busy:boolean)=>void}) {
 const [data,setData]=useState<Reading|null>(null),[error,setError]=useState(""),[revision,setRevision]=useState(0),[runId,setRunId]=useState<string>();
 useEffect(()=>{let active=true;void loadDocumentReading(itemId,runId).then(result=>{if(!active)return;if(result.data){setData(result.data);setError("");}else setError(result.error||"Transcription unavailable.");}).catch(()=>{if(active)setError("Transcription could not load. Please retry.");});return()=>{active=false;};},[itemId,runId,revision]);
 return <div className="document-reading-panel">
  {error&&<p role="alert">{error} <button className="subtle-button" onClick={()=>setRevision(n=>n+1)}>Retry transcription</button></p>}
  {!data&&!error&&<p role="status"><LoaderCircle className="memory-spinner" size={18}/> Loading transcription tools…</p>}
  {data&&<DocumentReview {...data} embedded onDirtyChange={onDirtyChange} onSavingChange={onSavingChange} onReload={id=>{if(id)setRunId(id);setRevision(n=>n+1);}}/>}
 </div>;
}
