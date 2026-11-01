"use server";
import { revalidatePath } from "next/cache";
import { requireSession } from "../backend/repository";
import { UUID_PATTERN } from "../backend/validation";
export async function reviewDocument(archiveId:string,itemId:string,form:FormData) {
  const read=(key:string)=>String(form.get(key)||"");
  if(![archiveId,itemId].every(v=>UUID_PATTERN.test(v)))return {error:"Invalid document."};
  try {
    const {client}=await requireSession();let result;
    const action=read("action");
    if(action==="text") {
      const id=read("transcriptionId");if(!UUID_PATTERN.test(id))return {error:"Invalid page."};
      const row=await client.from("transcriptions").select("id").eq("archive_id",archiveId).eq("item_id",itemId).eq("id",id).maybeSingle();
      if(row.error || !row.data)return {error:"Page unavailable."};
      result=await client.rpc("review_document_page",{p_transcription_id:id,p_text:read("text"),p_revision:Number(read("revision"))});
    } else if(action==="suggestions") {
      const id=read("runId");if(!UUID_PATTERN.test(id))return {error:"Invalid attempt."};
      const row=await client.from("document_runs").select("id").eq("archive_id",archiveId).eq("item_id",itemId).eq("id",id).maybeSingle();
      if(row.error || !row.data)return {error:"Attempt unavailable."};
      result=await client.rpc("apply_document_suggestions",{p_run_id:id,p_selections:JSON.parse(read("selections")),p_expected_date:JSON.parse(read("expectedDate"))});
    } else if(action==="order") {
      result=await client.rpc("order_document_pages",{p_item_id:itemId,p_version:read("version"),p_ids:JSON.parse(read("ids")),p_roles:JSON.parse(read("roles"))});
    } else return {error:"Unknown review action."};
    if(result.error)return {error:result.error.code==="40001"?"This information changed. Reload and review before saving.":result.error.message.includes("choose_existing")?"A matching record already exists. Select it instead of creating another.":"Not saved. Check the selected records, date format, page order and your Editor access, then retry."};
    revalidatePath("/","layout");return {ok:true};
  } catch {return {error:"Review could not be saved. Your draft is still here; please retry."};}
}
