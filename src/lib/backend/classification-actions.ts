"use server";
import {revalidatePath} from "next/cache";
import {requireSession} from "./repository";
import {UUID_PATTERN} from "./validation";
export async function changeItemKind(archiveId:string,itemId:string,kind:string,expected:string) {
  if(![archiveId,itemId].every(id=>UUID_PATTERN.test(id)))return {error:"Invalid item."};
  try {
    const {client}=await requireSession();
    const {error}=await client.rpc("set_item_kind",{p_archive_id:archiveId,p_item_id:itemId,p_kind:kind,p_expected:expected});
    if(error)return {error:error.code==="40001"?"The item type changed. Reload before saving again.":error.message.includes("document_busy")?"Wait for document processing to stop before changing the type.":"Item type not saved. Check your access and the classification setup."};
    revalidatePath("/","layout");return {ok:true};
  } catch {return {error:"Item type not saved. Your selection is still here; please retry."};}
}
