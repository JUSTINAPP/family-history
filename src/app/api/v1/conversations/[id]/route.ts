import {requireSession} from "@/lib/backend/repository";
import {allRows} from "@/lib/backend/catalogue";
import {BackendError,safeError} from "@/lib/backend/errors";
import {UUID_PATTERN} from "@/lib/backend/validation";
import type {FamilyComment} from "@/lib/conversation";
export const dynamic="force-dynamic";
export async function GET(request:Request,{params}:{params:Promise<{id:string}>}) {
  const headers={"Cache-Control":"private, no-store","Vary":"Cookie, Authorization"};
  try {
    const {client}=await requireSession();const {id}=await params;const archive=new URL(request.url).searchParams.get("archive")||"";
    if(!UUID_PATTERN.test(id)||!UUID_PATTERN.test(archive))throw new BackendError(404,"Conversation unavailable.");
    const item=await client.from("archive_items").select("id").eq("archive_id",archive).eq("id",id).maybeSingle();
    if(item.error||!item.data)throw new BackendError(404,"Conversation unavailable.");
    const result=await allRows<FamilyComment>((from,to)=>client.from("comments")
      .select("id,archive_id,item_id,author_id,body,created_at,edited_at,archived_at,parent_id,revision",{count:"exact"})
      .eq("archive_id",archive).eq("item_id",id).order("created_at").order("id").range(from,to).retry(false)
      .abortSignal(AbortSignal.timeout(5000)),r=>r.id);
    return Response.json({comments:result.data},{headers});
  } catch(error){const safe=safeError(error);return Response.json({error:safe.message},{status:safe.status,headers});}
}
