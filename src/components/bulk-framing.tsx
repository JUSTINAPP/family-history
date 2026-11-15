"use client";
import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { browserSupabase } from "@/lib/supabase/client";
import { ImageFraming, loadFraming, saveFraming, type FramingReview } from "./image-framing";
import { prepareDisplay } from "@/lib/preview/client";
type Entry={id:string;name:string;review?:FramingReview;error?:string;saved?:boolean};
export function BulkFraming({itemIds,automatic=false}:{itemIds:string[];automatic?:boolean}) {
  const ids=itemIds.join(","),router=useRouter();
  const [entries,setEntries]=useState<Entry[]>([]),[busy,setBusy]=useState(false),[message,setMessage]=useState("Loading imported images…"),[editing,setEditing]=useState<string>();
  const stop=useRef(false),alive=useRef(true),autoStarted=useRef(false);
  useEffect(()=>{alive.current=true;stop.current=false;let active=true;void (async()=>{
    const found:Entry[]=[];const sourceIds=ids.split(",");
    for(let n=0;n<sourceIds.length;n+=50){const result=await browserSupabase().from("archive_item_files").select("id,original_filename").in("item_id",sourceIds.slice(n,n+50)).eq("purpose","original").eq("status","stored");if(result.error)throw Error("Imported images could not load. Reopen this batch to retry.");for(const row of result.data||[])found.push({id:row.id,name:row.original_filename});}
    if(active){setEntries(found);setMessage("Review the suggestions before applying them. Uncertain images are marked Check crop.");}
  })().catch(e=>{if(active)setMessage(e.message);});return()=>{active=false;alive.current=false;stop.current=true;};},[ids]);
  async function check(list:Entry[]) {
    stop.current=false;setBusy(true);let failures=0;
    for(const [i,entry] of list.entries()) {
      if(stop.current||!alive.current)break;
      if(entry.review||entry.saved)continue;
      setMessage(`Checking image ${i+1} of ${list.length}…`);
      try {const review=await loadFraming(entry.id,true);const prepared=await prepareDisplay(`/api/v1/previews/${entry.id}`);if(prepared)review.expectedSet=prepared.id;if(alive.current)setEntries(old=>old.map(e=>e.id===entry.id?{...e,review,error:undefined}:e));}
      catch(error){failures++;if(alive.current)setEntries(old=>old.map(e=>e.id===entry.id?{...e,error:(error as Error).message}:e));}
      // Prepare unedited previews too; analysis itself never changes an image.
      try{await prepareDisplay(`/api/v1/previews/${entry.id}`);}catch{/* Review/retry remains available. */}
    }
    if(alive.current){setBusy(false);setMessage(stop.current?"Paused. Continue checking when ready.":failures?"Some images could not be checked. Review them manually or choose Check images to retry.":"Suggestions ready. Review any marked Check crop before saving.");}
  }
  useEffect(()=>{if(!automatic||!entries.length||autoStarted.current)return;autoStarted.current=true;void check(entries); // one pass per mounted batch
    // eslint-disable-next-line react-hooks/exhaustive-deps
  },[automatic,entries.length]);
  const confident=entries.filter(e=>!e.saved && e.review?.suggestion && !e.review.suggestion.needsReview && e.review.suggestion.confidence>=.9);
  async function accept() {
    stop.current=false;setBusy(true);let failures=0;
    for(const entry of confident){if(stop.current||!alive.current)break;try{
      // Preparation may have created a receipt after analysis; re-read and ensure no correction intervened.
      const current=await loadFraming(entry.id);
      if(JSON.stringify(current.framing)!==JSON.stringify(entry.review!.framing))throw Error("This image changed. Open it to review again.");
      await saveFraming(entry.id,current,entry.review!.suggestion!);
      if(alive.current)setEntries(old=>old.map(e=>e.id===entry.id?{...e,saved:true,error:undefined}:e));
    }catch(error){failures++;if(alive.current)setEntries(old=>old.map(e=>e.id===entry.id?{...e,error:(error as Error).message}:e));}}
    if(alive.current){setBusy(false);setMessage(failures?"Some corrections need retry. Saved corrections are kept.":"Selected corrections saved. Originals are kept.");router.refresh();}
  }
  return <section className="framing-batch"><h2>Review rotation and crops</h2><p>Suggestions use the archive’s configured image-reading service. Your originals are already safely uploaded.</p>
    <div className="import-actions"><button type="button" className="button" disabled={busy||!entries.length} onClick={()=>void check(entries)}>Check images</button><button type="button" className="subtle-button" disabled={busy||!confident.length} onClick={()=>void accept()}>Accept {confident.length} confident suggestions</button>{busy&&<button type="button" className="subtle-button" onClick={()=>{stop.current=true;setMessage("Pausing after the current image…");}}>Pause</button>}</div>
    <p role="status">{message}</p><div className="framing-batch-list">{entries.map(entry=><article key={entry.id}>{entry.review&&<>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={entry.review.image} alt={entry.name}/></>}<p>{entry.name}</p><p>{entry.saved?"Correction saved":entry.error?"Check crop":entry.review?.suggestion?(entry.review.suggestion.needsReview||entry.review.suggestion.confidence<.9?"Check crop":"Suggested correction ready"):"Not checked yet"}</p>{entry.error&&<p className="help-line">{entry.error}</p>}<button type="button" className="subtle-button" disabled={busy} onClick={()=>setEditing(entry.id)}>Review / adjust</button></article>)}</div>
    {editing&&<ImageFraming sourceId={editing} initial={entries.find(e=>e.id===editing)?.saved ? undefined : entries.find(e=>e.id===editing)?.review} onClose={()=>setEditing(undefined)} onSaved={()=>setEntries(old=>old.map(e=>e.id===editing?{...e,saved:true,error:undefined}:e))}/>}
  </section>;
}
