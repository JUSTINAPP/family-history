import "server-only";
import {cache} from "react";
import {requireSession} from "../backend/repository";
import {allRows} from "../backend/catalogue";
import type {ReviewedSuggestion} from "./correspondence";
/** Request-scoped only: no cross-user or process-global document cache. */
export const documentContext=cache(async(archiveId:string,itemIds:string)=>{
  const {client}=await requireSession();
  const ids=itemIds.split(",").filter(Boolean);
  const suggestions:ReviewedSuggestion[]=[], texts:{id:string;item_id:string;review_status:string}[]=[];
  for(let n=0;n<ids.length;n+=100){
    const batch=ids.slice(n,n+100);
    const [reviewed,transcribed]=await Promise.all([
      allRows<ReviewedSuggestion>((from,to)=>client.from("metadata_suggestions")
        .select("id,item_id,status,field_path,reviewed_value,reviewed_at",{count:"exact"}).eq("archive_id",archiveId).in("item_id",batch)
        .eq("status","accepted").in("field_path",["document.sender","document.recipient","document.person"])
        .order("id").range(from,to).retry(false).abortSignal(AbortSignal.timeout(3000)),r=>r.id),
      allRows<{id:string;item_id:string;review_status:string}>((from,to)=>client.from("transcriptions")
        .select("id,item_id,review_status",{count:"exact"}).eq("archive_id",archiveId).in("item_id",batch).eq("modality","handwriting")
        .eq("output_kind","source").not("document_run_id","is",null).order("id").range(from,to).retry(false).abortSignal(AbortSignal.timeout(3000)),r=>r.id),
    ]);suggestions.push(...reviewed.data);texts.push(...transcribed.data);
  }
  return {suggestions,texts};
});
