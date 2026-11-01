"use client";
import {useState} from "react";
import {useRouter} from "next/navigation";
import {correspondenceDate} from "@/lib/documents/correspondence";
import {reviewChoice,type ReviewChoice} from "@/lib/documents/review-choice";
import {reviewDocument} from "@/lib/documents/actions";
import type {StoredDocumentSuggestion} from "@/lib/documents/repository";
import type {Person} from "@/lib/types";
import type {ArchivePlace} from "@/lib/places";
export function DocumentReviewSummary({archiveId,itemId,runId,suggestions,people,places,editor,date,precision}:{
  archiveId:string;itemId:string;runId:string;suggestions:StoredDocumentSuggestion[];people:Person[];places:ArchivePlace[];editor:boolean;date:string;precision:string;
}) {
  const router=useRouter();
  const [choices,setChoices]=useState(()=>suggestions.map(reviewChoice));
  const [changing,setChanging]=useState<string[]>([]),[busy,setBusy]=useState(false),[message,setMessage]=useState("");
  function patch(id:string,value:Partial<ReviewChoice>){setChoices(old=>old.map(c=>c.id===id?{...c,...value}:c));}
  async function decide(s:StoredDocumentSuggestion,action:"accept"|"reject") {
    const choice=choices.find(c=>c.id===s.id)!;
    if(action==="accept"&&["person","place"].includes(s.suggested_value.kind)&&!choice.canonical_id&&!choice.create){
      setChanging(old=>old.includes(s.id)?old:[...old,s.id]);setMessage("Choose an existing record or deliberately create one before linking.");return;
    }
    setBusy(true);setMessage("");const form=new FormData();const {selected,...decision}=choice;void selected;
    form.set("action","suggestions");form.set("runId",runId);form.set("selections",JSON.stringify([{...decision,action}]));form.set("expectedDate",JSON.stringify({value:date,precision}));
    try{const result=await reviewDocument(archiveId,itemId,form);setMessage(result.error||"Review saved. Original AI wording retained.");if(!result.error)router.refresh();}
    catch{setMessage("Could not save. Your changes remain here; please retry.");}finally{setBusy(false);}
  }
  if(!suggestions.length)return null;
  const labels={sender:"From",recipient:"To",date:"Date",place:"Place",person:"People mentioned",summary:"Summary",topic:"Topics"} as const;
  return <section className="document-review-summary" aria-label="Review what AI found"><h2>Review what AI found</h2><p>Check these drafts against the letter. Only your confirmed choices are kept.</p>
    {!editor&&<p>An Editor can confirm or change these suggestions.</p>}
    <h3>Correspondence</h3>
    {(["sender","recipient","date","place","person","summary","topic"] as const).map(kind=>{
      const rows=suggestions.filter(s=>s.suggested_value.kind===kind);
      if(!rows.length)return ["sender","recipient","date","place"].includes(kind)?<div className="review-summary-row" key={kind}><h4>{labels[kind]}</h4><p>Not identified</p></div>:null;
      return <section key={kind} aria-label={labels[kind]}><h4>{labels[kind]}</h4>{rows.map(s=>{
        const c=choices.find(c=>c.id===s.id)!,edit=changing.includes(s.id),person=["sender","recipient","person"].includes(kind),place=kind==="place";
        return <article className="review-summary-row" key={s.id}>
          <p>{kind==="date"?correspondenceDate(s.status==="pending"?c.value:s.reviewed_value?.value||s.suggested_value.value,s.reviewed_value?.precision||c.precision):s.status==="pending"?c.value:s.reviewed_value?.value||s.suggested_value.value}</p>
          {s.status!=="pending"?<p className="help-line">{s.status==="accepted"?"Human reviewed":"Ignored"}</p>:editor&&<>
            {edit&&<div className="review-summary-change">
              <label className="field">{labels[kind]}<input aria-label={`Change ${labels[kind]}: ${s.suggested_value.value}`} value={c.value} maxLength={2000} onChange={e=>patch(c.id,{value:e.target.value})}/></label>
              {(person||place)&&<>
                <label className="field">{person?"Link a Person (optional for From/To)":"Link a Place"}<select aria-label={`Link ${s.suggested_value.value}`} value={c.canonical_id} onChange={e=>patch(c.id,{canonical_id:e.target.value,create:false,text_only:!e.target.value&&["sender","recipient"].includes(kind)})}>
                  <option value="">{["sender","recipient"].includes(kind)?"Keep reviewed text only":"Choose a record"}</option>
                  {(person?people:places).map(p=><option key={p.id} value={p.id}>{p.name}</option>)}
                </select></label>
                {!c.canonical_id&&<label><input type="checkbox" checked={c.create} onChange={e=>patch(c.id,{create:e.target.checked,text_only:!e.target.checked&&["sender","recipient"].includes(kind)})}/> Create {c.value} as a {person?"Person":"Place"}</label>}
              </>}
              {kind==="date"&&<><label className="field">Date meaning<select value={c.context} onChange={e=>patch(c.id,{context:e.target.value})}><option value="written_date">Document date</option><option value="mentioned_date">Date mentioned only</option></select></label><label className="field">Precision<select value={c.precision} onChange={e=>patch(c.id,{precision:e.target.value})}>{["exact","month","year","approximate","decade","unknown"].map(p=><option key={p}>{p}</option>)}</select></label></>}
              <p className="help-line">Source wording: “{s.suggested_value.evidence}” · page {s.suggested_value.page}</p>
            </div>}
            <div className="import-actions"><button className="subtle-button" disabled={busy} onClick={()=>void decide(s,"accept")}>{kind==="person"?"Link person":kind==="summary"||kind==="topic"?"Accept":"Confirm"}</button>
              <button className="subtle-button" disabled={busy} onClick={()=>setChanging(old=>old.includes(s.id)?old.filter(id=>id!==s.id):[...old,s.id])}>{edit?"Done changing":kind==="summary"?"Edit":kind==="topic"?"Review topic":"Change"}</button>
              <button className="subtle-button" disabled={busy} onClick={()=>void decide(s,"reject")}>Ignore</button></div>
            {["sender","recipient"].includes(kind)&&!c.canonical_id&&!c.create&&<p className="help-line">Confirm keeps reviewed text. Creating a Person is optional.</p>}
          </>}
        </article>;
      })}</section>;
    })}
    {message&&<p role="status">{message}</p>}
  </section>;
}
