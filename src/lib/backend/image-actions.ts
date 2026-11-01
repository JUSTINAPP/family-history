"use server";
import { revalidatePath } from "next/cache";
import { requireSession } from "./repository";
import { UUID_PATTERN } from "./validation";
export async function rotateImage(sourceId: string, turn: number, expected: number) {
  if (!UUID_PATTERN.test(sourceId) || ![-90,90].includes(turn) || ![0,90,180,270].includes(expected)) return {error:"Invalid image rotation."};
  try {
    const {client}=await requireSession();
    const {data,error}=await client.rpc("rotate_item_image",{p_source_id:sourceId,p_turn:turn,p_expected:expected});
    if(error)return {error:error.code==="40001"?"This image changed. Reload before rotating again.":"Rotation not saved. Check your access and retry."};
    revalidatePath("/","layout");return {rotation:Number(data)};
  } catch {return {error:"Rotation not saved. Check your connection and retry."};}
}
