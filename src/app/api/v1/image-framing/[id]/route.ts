import { requireSession } from "@/lib/backend/repository";
import { BackendError, safeError } from "@/lib/backend/errors";
import { UUID_PATTERN } from "@/lib/backend/validation";
import { isSameOriginRequest } from "@/lib/backend/request-origin";
import { convertPreview } from "@/lib/preview/convert";
import { documentProvider } from "@/lib/documents/provider";
import { fullFrame, validateSuggestion } from "@/lib/preview/framing";
import { createHash } from "node:crypto";
export const runtime="nodejs";
export const maxDuration=120;
const headers={"Cache-Control":"private, no-store"};
type Context={params:Promise<{id:string}>};
async function load(context:Context) {
  const {client,user}=await requireSession();const {id}=await context.params;
  if(!UUID_PATTERN.test(id))throw new BackendError(404,"Image not found.");
  const result=await client.from("archive_item_files").select("*").eq("id",id).eq("purpose","original").eq("status","stored").maybeSingle();
  const original=result.data;if(result.error || !original)throw new BackendError(404,"Image not found.");
  const [access,item]=await Promise.all([client.rpc("can_access_archive",{p_archive_id:original.archive_id,p_minimum:"editor"}),client.from("archive_items").select("contributed_by,archived_at,lifecycle").eq("id",original.item_id).single()]);
  if(item.error || !item.data || item.data.lifecycle!=="active" || item.data.archived_at)throw new BackendError(403,"This item cannot be adjusted.");
  if(!access.data){const permission=await client.rpc("can_access_archive",{p_archive_id:original.archive_id,p_minimum:"contributor"});if(!permission.data || item.data.contributed_by!==user.id)throw new BackendError(403,"Only an editor or the contributor can adjust this image.");}
  const current=await client.from("image_sets").select("id,manifest").eq("original_file_id",id).eq("status","stored").order("created_at",{ascending:false}).limit(1).maybeSingle();
  if(current.error)throw new BackendError(503,"Preview information could not load.");
  if(original.byte_size>30*1024*1024)throw new BackendError(422,"This original is too large to adjust here.");
  const download=await client.storage.from(original.bucket_id).download(original.storage_path,{}, {signal:AbortSignal.timeout(10000)});
  if(download.error || !download.data)throw new BackendError(503,"Could not load the original. Please retry.");
  const bytes=new Uint8Array(await download.data.arrayBuffer());
  if(bytes.length!==Number(original.byte_size) || createHash("sha256").update(bytes).digest("hex")!==original.sha256)throw new BackendError(409,"Original integrity could not be confirmed.");
  const preview=await convertPreview(bytes);
  const prior=current.data?.manifest?.framing;
  return {image:`data:image/webp;base64,${Buffer.from(preview.thumbnail.bytes).toString("base64")}`,
    expectedSet:current.data?.id || null,expectedRotation:original.presentation_rotation || 0,
    framing:prior ? {points:prior.points,rotation:(prior.rotation+(original.presentation_rotation||0)-prior.baseRotation+360)%360} : {...fullFrame(),rotation:original.presentation_rotation||0}};
}
export async function GET(_request:Request,context:Context) {
  try{return Response.json(await load(context),{headers});}catch(error){const e=safeError(error);return Response.json({error:e.message},{status:e.status,headers});}
}
export async function POST(request:Request,context:Context) {
  try {
    if(!isSameOriginRequest(request))throw new BackendError(403,"Open the archive to check an image.");
    const provider=documentProvider();
    if(!provider?.frameImage)throw new BackendError(503,"Automatic suggestions are not configured yet. You can still adjust the corners and rotate manually.");
    const loaded=await load(context);
    let suggestion;
    try{suggestion=validateSuggestion(await provider.frameImage(loaded.image));}catch{throw new BackendError(503,"No reliable suggestion was returned. Adjust the corners manually or retry.");}
    return Response.json({...loaded,suggestion},{headers});
  }catch(error){const e=safeError(error);return Response.json({error:e.message},{status:e.status,headers});}
}
