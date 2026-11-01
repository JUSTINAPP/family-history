"use client";
import Link from "next/link";
import { useRef,useState } from "react";
import { useRouter } from "next/navigation";
import {DocumentImages} from "./document-images";
import { DocumentSuggestions } from "./document-suggestions";
import { reviewDocument } from "@/lib/documents/actions";
import { pageLabel,type DocumentRun,type DocumentRunSummary,type DocumentPageText,type DocumentSource,type DocumentOperation } from "@/lib/documents/types";
import type { StoredDocumentSuggestion } from "@/lib/documents/repository";
import type { ImageSet } from "@/lib/preview/types";
import type { Person } from "@/lib/types";
import type { ArchivePlace } from "@/lib/places";
export function DocumentReview({archiveId,itemId,kind,title,files,sets,source,runs,run,pages,suggestions,configured,canProcess,editor,people,places,date,precision}: {
  archiveId:string;itemId:string;kind:string;title:string;files:{id:string;page_order:number;page_role:string;original_filename:string;presentation_rotation?:number}[];sets:ImageSet[];
  source:{version:string;pages:DocumentSource[]};runs:DocumentRunSummary[];run:DocumentRun|null;pages:DocumentPageText[];suggestions:StoredDocumentSuggestion[];
  configured:boolean;canProcess:boolean;editor:boolean;people:Person[];places:ArchivePlace[];date:string;precision:string;
}) {
  const router=useRouter();const request=useRef<string|null>(null);
  const [selected,setSelected]=useState(0),[raw,setRaw]=useState(false),[busy,setBusy]=useState(false),[message,setMessage]=useState("");
  const [confirm,setConfirm]=useState<DocumentOperation|null>(null),[draft,setDraft]=useState<{id:string;revision:number;text:string}|null>(null);
  const [arranging,setArranging]=useState(false),[order,setOrder]=useState(files.map(f=>f.id));
  const ordered=run?.source_manifest || source.pages;
  const current=ordered[Math.min(selected,ordered.length-1)],file=files.find(f=>f.id===current?.id),text=pages.find(p=>p.original_file_id===current?.id);
  async function post(url:string,body:object) {
    const response=await fetch(url,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify(body)});
    const result=await response.json();if(!response.ok)throw new Error(result.error || "Processing could not finish.");return result;
  }
  async function process(operation:DocumentOperation,resume=false) {
    setBusy(true);setConfirm(null);setMessage("");let knownId=resume?run?.id:undefined;
    try {
      request.current ||= crypto.randomUUID();
      const started=resume && run?await post(`/api/v1/document-runs/${run.id}`,{action:"resume"}):await post(`/api/v1/documents/${itemId}`,{
        operation,requestId:request.current,version:source.version,sourceRunId:operation==="translate"?run?.id:null,
      });
      knownId=started.id;request.current=null;
      for(let n=0;n<started.pages.length;n++){
        setMessage(`${operation==="translate"?"Translating":"Transcribing"} page ${n+1} of ${started.pages.length}…`);
        await post(`/api/v1/document-runs/${started.id}`,{action:"page",fileId:started.pages[n].id});
      }
      setMessage(operation==="translate"?"Keeping the English draft separately…":"Preparing draft suggestions for review…");
      await post(`/api/v1/document-runs/${started.id}`,{action:"finish"});
      setMessage("Draft ready for human review.");router.push(`/archive/${itemId}/review?run=${started.id}`);router.refresh();
    } catch(error){setMessage(error instanceof Error?error.message:"Processing was interrupted. Saved page drafts are retained.");if(knownId){router.replace(`/archive/${itemId}/review?run=${knownId}`);router.refresh();}}
    finally{setBusy(false);}
  }
  return <div className="document-review">
    <div className="section-top baseline"><div><p className="eyebrow">THE SOURCE. THE WORDS.</p><h1>{title}</h1></div><Link className="text-link" href={`/archive/${itemId}`}>Back to item ↗</Link></div>
    {!configured && <p className="notice">AI transcription is not configured. An archive administrator can enable it later. You can read the pages now; their originals are preserved.</p>}
    <div className="import-actions">
      {canProcess && <button className="button" disabled={busy||!configured} onClick={()=>setConfirm("transcribe")}>{runs.some(r=>r.operation==="transcribe")?"Transcribe again":kind==="Letter"?"Transcribe letter":"Transcribe document"}</button>}
      {canProcess && run?.operation==="transcribe" && run.source_version===source.version && pages.length===run.source_manifest.length && <button className="subtle-button" disabled={busy||!configured} onClick={()=>setConfirm("translate")}>Translate into English</button>}
      {canProcess && run && run.status!=="complete" && <>
        <button className="subtle-button" disabled={busy||!configured} onClick={()=>void process(run.operation,true)}>Resume this attempt</button>
        <button className="subtle-button" disabled={busy} onClick={async()=>{try{await post(`/api/v1/document-runs/${run.id}`,{action:"cancel"});setMessage("Attempt stopped. Saved page drafts remain in history.");router.refresh();}catch{setMessage("Could not stop this attempt. Reload and check its state.");}}}>Stop this attempt</button>
      </>}
    </div>
    {confirm && <section className="notice" role="dialog" aria-labelledby="document-confirm-title">
      <h2 id="document-confirm-title">{confirm==="translate"?"Translate":"Transcribe"} {source.pages.length} pages?</h2>
      <p>{confirm==="translate"?"The saved source transcription will be sent to the configured AI service for a separate English draft.":"Copies of these ordered pages will be sent to the configured AI service for transcription and draft suggestions."} This may incur processing costs. Originals and earlier attempts stay unchanged.</p>
      <button className="subtle-button" onClick={()=>setConfirm(null)}>Cancel</button><button className="button" onClick={()=>void process(confirm)}>{confirm==="translate"?"Translate these pages":"Transcribe these pages"}</button>
    </section>}
    {message && <p role="status" className="notice">{message}</p>}
    {run && <p>{run.operation==="translate"?"English translation":"Source-language transcription"} · {run.status==="complete"?"Draft ready for review":run.status==="failed"?"Incomplete attempt — saved page drafts retained":"Processing attempt"}
      {run.operation==="translate" && <>{" "}<Link href={`/archive/${itemId}/review?run=${run.source_run_id}`}>Read source transcription ↗</Link></>}
    </p>}
    {run && run.source_version!==source.version && <p className="notice">The page sequence changed after this attempt. These words retain their earlier page references; transcribe again to use the current order.</p>}
    <nav className="quick-navigation" aria-label="Transcription pages">
      <button className="subtle-button" disabled={!selected} onClick={()=>{setSelected(selected-1);setDraft(null);}}>Previous page</button>
      <span aria-live="polite">{selected+1} of {ordered.length} · {current && pageLabel(current.page_role,selected)}</span>
      <button className="subtle-button" disabled={selected>=ordered.length-1} onClick={()=>{setSelected(selected+1);setDraft(null);}}>Next page</button>
    </nav>
    <div className="document-review-grid">
      <section><h2>Original</h2>{file?<DocumentImages pages={ordered.map(p=>({id:p.id,presentation_rotation:files.find(f=>f.id===p.id)?.presentation_rotation}))} sets={sets} selected={selected} title={`Document page ${selected+1}`}/>:<p>Original page unavailable.</p>}</section>
      <section aria-label="Page transcription">
        <h2>{text?.output_kind==="translation"?"English translation": "Source transcription"}</h2>
        {!text?<p>This page has no transcription yet.</p>:<>
          <p>{text.reviewed_text!==null&&!raw?"Human-reviewed text":"AI draft — please check unclear handwriting against the page"}</p>
          {!!(run?.output[current!.id] as {uncertainty?:string[]}|undefined)?.uncertainty?.length && <details><summary>Reading notes</summary><p className="help-line">Original AI uncertainty: {((run!.output[current!.id] as {uncertainty:string[]}).uncertainty).join(" · ")}</p></details>}
          <div className="document-text">{!raw&&text.reviewed_text!==null?text.reviewed_text:text.raw_ai_text}</div>
          {text.reviewed_text!==null && <button className="subtle-button" onClick={()=>setRaw(!raw)}>{raw?"View human-reviewed text":"View original AI draft"}</button>}
          {editor && <button className="subtle-button" disabled={busy} onClick={()=>setDraft({id:text.id,revision:text.review_revision,text:text.reviewed_text??text.raw_ai_text})}>Correct this page</button>}
          {draft?.id===text.id && <form onSubmit={async e=>{
            e.preventDefault();setBusy(true);const data=new FormData(e.currentTarget);data.set("action","text");data.set("transcriptionId",draft.id);data.set("revision",String(draft.revision));
            try{const result=await reviewDocument(archiveId,itemId,data);setMessage(result.error||"Human correction saved. The original AI draft is unchanged.");if(!result.error){setDraft(null);setRaw(false);router.refresh();}}catch{setMessage("Could not save the correction. Your draft is still here.");}finally{setBusy(false);}
          }}>{text.output_kind==="source" && <p className="help-line">Keep corrections in the source language. English translation has its own version.</p>}<label className="field"><span>Corrected transcription</span><textarea aria-label="Corrected transcription" name="text" defaultValue={draft.text} maxLength={50000} rows={18}/></label>
            <button className="button" disabled={busy}>Save human correction</button><button type="button" className="subtle-button" onClick={()=>setDraft(null)}>Cancel correction</button>
          </form>}
        </>}
      </section>
    </div>
    {run && <DocumentSuggestions key={run.id} archiveId={archiveId} itemId={itemId} runId={run.id} suggestions={suggestions} people={people} places={places} editor={editor&&canProcess&&run.status==="complete"&&run.source_version===source.version} date={date} precision={precision}/>}
    {editor && <details><summary>Arrange document pages</summary><p>Change reading order without replacing any original. Earlier text keeps its original page references.</p>
      <button className="subtle-button" disabled={busy} onClick={()=>{setOrder(files.map(f=>f.id));setArranging(!arranging);}}>Review page order</button>
      {arranging && <><ol>{order.map((id,n)=><li key={id}>{files.find(f=>f.id===id)?.original_filename}
        <button className="subtle-button" disabled={!n} aria-label={`Move document page ${n+1} earlier`} onClick={()=>setOrder(ids=>{const next=[...ids];[next[n],next[n-1]]=[next[n-1],next[n]];return next;})}>Move earlier</button>
      </li>)}</ol><button className="button" disabled={busy} onClick={async()=>{const form=new FormData();form.set("action","order");form.set("version",source.version);form.set("ids",JSON.stringify(order));form.set("roles",JSON.stringify(order.map(id=>files.find(f=>f.id===id)?.page_role||"page")));setBusy(true);try{const result=await reviewDocument(archiveId,itemId,form);setMessage(result.error||"Page order saved. Original files are unchanged.");if(!result.error){setArranging(false);router.refresh();}}finally{setBusy(false);}}}>Save page order</button></>}
    </details>}
    <details className="archive-information"><summary>Processing history</summary><p>Each attempt retains its page set, provider, model and text versions. A failed request may already have incurred a charge; resuming reuses saved page drafts.</p>
      <ul>{runs.map(r=><li key={r.id}><Link href={`/archive/${itemId}/review?run=${r.id}`}>{r.operation} · {new Date(r.created_at).toLocaleString("en-AU",{timeZone:"Australia/Sydney"})} · {r.provider} / {r.model} · {r.status} · {r.source_manifest.length} pages</Link></li>)}</ul>
      {run?.operation==="translate" && <details><summary>Source text used for this translation</summary><p className="document-text">{run.source_texts?.find(p=>p.original_file_id===current?.id)?.text||"Source snapshot retained with this attempt."}</p></details>}
      {text && <p>Page version {text.version} · {text.provider} / {text.model} · processed {text.processed_at} · human review revision {text.review_revision}</p>}
    </details>
  </div>;
}
