"use server";
import {requireSession} from "./repository";
import {UUID_PATTERN} from "./validation";
import {imageSet, type ImageSetRow} from "../preview/types";

/** Read saved page membership only; never infer pairs from filenames. */
export async function loadItemPages(archiveId:string,itemId:string) {
 try {
  if(!UUID_PATTERN.test(archiveId)||!UUID_PATTERN.test(itemId))throw new Error();
  const {client}=await requireSession();
  const [files,sets]=await Promise.all([
   client.from("archive_item_files").select("id,page_order,page_role,presentation_rotation")
    .eq("archive_id",archiveId).eq("item_id",itemId).eq("purpose","original").eq("status","stored")
    .order("page_order").order("id").retry(false).abortSignal(AbortSignal.timeout(5000)),
   client.from("current_image_sets").select("*").eq("item_id",itemId).eq("status","stored")
    .order("created_at",{ascending:false}).retry(false).abortSignal(AbortSignal.timeout(5000)),
  ]);
  if(files.error||sets.error||!files.data?.length)throw new Error();
  return {pages:files.data.map(file=>({id:file.id as string,role:file.page_role as string,rotation:Number(file.presentation_rotation)||0,
   imageSet:sets.data?.find(set=>set.original_file_id===file.id)?imageSet(sets.data.find(set=>set.original_file_id===file.id) as ImageSetRow):undefined}))};
 }catch{return {error:"Saved pages could not load. Please retry."};}
}
