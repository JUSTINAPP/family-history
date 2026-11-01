"use client";
import { matchingPeople } from "@/lib/identifications";
import { matchingPlaces } from "@/lib/places";
import { useState } from "react";
import { useRouter } from "next/navigation";
import type { Person } from "@/lib/types";
import type { ArchivePlace } from "@/lib/places";
import type { StoredDocumentSuggestion } from "@/lib/documents/repository";
import {reviewChoice,type ReviewChoice as Choice} from "@/lib/documents/review-choice";
import {DocumentReviewSummary} from "./document-review-summary";
import { reviewDocument } from "@/lib/documents/actions";
function DetailedDocumentSuggestions({archiveId,itemId,runId,suggestions,people,places,editor,date,precision}: {
  archiveId:string;itemId:string;runId:string;suggestions:StoredDocumentSuggestion[];people:Person[];places:ArchivePlace[];editor:boolean;date:string;precision:string;
}) {
  const router=useRouter();
  const [choices,setChoices]=useState<Choice[]>(()=>suggestions.map(reviewChoice));
  const [expectedDate]=useState({value:date,precision});
  const [message,setMessage]=useState(""),[busy,setBusy]=useState(false);
  function patch(id:string,change:Partial<Choice>){setChoices(old=>old.map(c=>c.id===id?{...c,...change}:c));}
  if(!suggestions.length)return <p>No structured suggestions were produced for this attempt.</p>;
  return <section aria-label="AI suggestions"><h2>AI found</h2><p>These are drafts, not established facts. Select only what you have checked against the pages.</p>
    {!editor && <p>An Editor can review these suggestions.</p>}
    <form onSubmit={async e=>{
      e.preventDefault();setBusy(true);setMessage("");
      const selected=choices.filter(c=>c.selected && suggestions.some(s=>s.id===c.id && s.status==="pending")).map(({selected,...c})=>{void selected;return c;});
      if(!selected.length){setMessage("Select at least one suggestion to review.");setBusy(false);return;}
      const form=new FormData();form.set("action","suggestions");form.set("runId",runId);form.set("selections",JSON.stringify(selected));form.set("expectedDate",JSON.stringify(expectedDate));
      try {const result=await reviewDocument(archiveId,itemId,form);setMessage(result.error||"Selected suggestions reviewed. Original AI drafts are retained.");if(!result.error)router.refresh();}
      catch {setMessage("Could not save your review. Please retry.");}finally{setBusy(false);}
    }}>
      {suggestions.map(s=>{
        const c=choices.find(c=>c.id===s.id)!;const kind=s.suggested_value.kind;
        const person=["person","sender","recipient"].includes(kind),place=kind==="place",pending=s.status==="pending";
        return <article className="document-suggestion" key={s.id}>
          <p className="eyebrow">{kind} · page {s.suggested_value.page}</p>
          <blockquote>{s.suggested_value.evidence}</blockquote>
          {pending && editor ? <>
            <label><input type="checkbox" checked={c.selected} onChange={e=>patch(c.id,{selected:e.target.checked})} /> Review {s.suggested_value.value}</label>
            <label className="field">Decision<select aria-label={`Decision for ${s.suggested_value.value}`} value={c.action} onChange={e=>patch(c.id,{action:e.target.value})}><option value="accept">Keep / apply</option><option value="reject">Discard suggestion</option></select></label>
            {c.action==="accept" && <>
              <label className="field">Reviewed value<input aria-label={`Reviewed value for ${s.suggested_value.value}`} value={c.value} maxLength={2000} onChange={e=>patch(c.id,{value:e.target.value})} /></label>
              {(person || place) && <>
                <p className="help-line">{person ? matchingPeople(people,c.value).slice(0,3).map(p=>`Possible existing Person: ${p.name}`).join(" · ") : matchingPlaces(places,c.value).slice(0,3).map(p=>`Possible existing Place: ${p.name}`).join(" · ")}</p>
                <label className="field">{person?"Match an existing Person":"Match an existing Place"}<select aria-label={`Match ${s.suggested_value.value}`} value={c.canonical_id} onChange={e=>patch(c.id,{canonical_id:e.target.value,create:false,text_only:false})}>
                  <option value="">Choose a record — no automatic link</option>
                  {person?people.map(p=><option key={p.id} value={p.id}>{p.name}</option>):places.map(p=><option key={p.id} value={p.id}>{p.name}{p.country?` · ${p.country}`:""}</option>)}
                </select></label>
                {!c.canonical_id && <label><input type="checkbox" checked={c.create} onChange={e=>patch(c.id,{create:e.target.checked,text_only:false})} /> Deliberately create a new {person?"Person":"Place"} with this name</label>}
                {["sender","recipient"].includes(kind)&&!c.canonical_id&&!c.create&&<label><input type="checkbox" checked={c.text_only} onChange={e=>patch(c.id,{text_only:e.target.checked})}/> Keep as reviewed text (no Person record)</label>}
                <label className="field">Connection<select aria-label={`Connection for ${s.suggested_value.value}`} value={c.context} onChange={e=>patch(c.id,{context:e.target.value})}>
                  {person?<><option value="mentioned">Person mentioned</option><option value="sender">Author / sender</option><option value="recipient">Recipient</option></>:<><option value="related">Place mentioned</option><option value="written_in">Written from</option><option value="sent_to">Destination</option></>}
                </select></label>
              </>}
              {kind==="date" && <>
                <label className="field">Date meaning<select aria-label="Date meaning" value={c.context} onChange={e=>patch(c.id,{context:e.target.value})}><option value="mentioned_date">Date mentioned only — keep as context</option><option value="written_date">Apply as the document date</option></select></label>
                {c.context==="written_date" && <label className="field">Date precision<select aria-label="Suggested date precision" value={c.precision} onChange={e=>patch(c.id,{precision:e.target.value,...(e.target.value==="unknown"?{context:"mentioned_date"}:{})})}><option value="exact">Exact date (YYYY-MM-DD)</option><option value="month">Month (YYYY-MM)</option><option value="year">Year (YYYY)</option><option value="approximate">Approximate year (YYYY)</option><option value="decade">Decade (1980s)</option><option value="unknown">Uncertain — keep as context</option></select></label>}
              </>}
            </>}
          </>:<p>{s.reviewed_value?.value||s.suggested_value.value} · {s.status==="pending"?"AI draft":s.status==="accepted"?"Reviewed and kept":"Discarded"}</p>}
        </article>;
      })}
      {editor && suggestions.some(s=>s.status==="pending") && <button className="button" disabled={busy}>Apply selected suggestions</button>}
    </form>
    {message && <p role="status">{message}</p>}
  </section>;
}

export function DocumentSuggestions(props:Parameters<typeof DetailedDocumentSuggestions>[0]) {
  return <><DocumentReviewSummary {...props}/><details className="advanced-document-review"><summary>Advanced review</summary><p>Inspect the original evidence and review each suggestion in detail. Earlier AI wording and decisions remain in the archive.</p><DetailedDocumentSuggestions {...props}/></details></>;
}
