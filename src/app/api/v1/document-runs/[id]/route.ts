import { requireSession } from "@/lib/backend/repository";
import { BackendError,safeError } from "@/lib/backend/errors";
import { UUID_PATTERN } from "@/lib/backend/validation";
import { isSameOriginRequest } from "@/lib/backend/request-origin";
import { documentProvider } from "@/lib/documents/provider";
import { documentBody,documentRun,documentPageImage,runPages,rpcResult } from "@/lib/documents/server";
export const runtime="nodejs";
export const maxDuration=60;
const headers={"Cache-Control":"private, no-store"};
export async function POST(request:Request,{params}:{params:Promise<{id:string}>}) {
  let active: {id:string;client:Awaited<ReturnType<typeof requireSession>>["client"]}|null=null;
  try {
    if(!isSameOriginRequest(request))throw new BackendError(403,"Request origin denied.");
    const {client}=await requireSession();const {id}=await params;
    if(!UUID_PATTERN.test(id))throw new BackendError(404,"Attempt not found.");
    const run=await documentRun(client,id),body=await documentBody(request);
    if(body.action==="cancel" || body.action==="resume") {
      rpcResult(await client.rpc("set_document_run_state",{p_run_id:id,p_resume:body.action==="resume",p_error:"cancelled"}));
      return Response.json({id,pages:run.source_manifest},{headers});
    }
    if(body.action!=="page" && body.action!=="finish")throw new BackendError(400,"Choose an attempt action.");
    if(run.status==="complete")return Response.json({complete:true},{headers});
    const provider=documentProvider();
    if(!provider)throw new BackendError(503,"AI transcription is not configured.");
    if(provider.name!==run.provider || provider.model!==run.model)throw new BackendError(409,"The processing model changed. Start a new attempt so its history stays accurate.");
    if(body.action==="page") {
      const fileId=String(body.fileId || "");if(!UUID_PATTERN.test(fileId))throw new BackendError(400,"Choose a page.");
      const claim=rpcResult(await client.rpc("claim_document_page",{p_run_id:id,p_file_id:fileId}));
      if(claim.cached)return Response.json({cached:true},{headers});
      active={id,client};
      const sourceText=run.source_texts?.find(p=>p.original_file_id===fileId);
      const image=run.operation==="transcribe"?await documentPageImage(client,run,fileId):null;
      const reading=await provider.readPage({image:image?.url||"",operation:run.operation,sourceText:sourceText?.text});
      rpcResult(await client.rpc("save_document_page",{p_run_id:id,p_file_id:fileId,p_token:claim.token,p_output:{...reading,input_provenance:image?.provenance||{source_transcription_id:sourceText?.transcription_id,review_revision:sourceText?.review_revision}}}));
      return Response.json({saved:true},{headers});
    }
    const claim=rpcResult(await client.rpc("claim_document_extraction",{p_run_id:id}));
    if(claim.cached)return Response.json({complete:true},{headers});
    active={id,client};
    const pages=await runPages(client,id);
    const extraction=run.operation==="translate"?{suggestions:[]}:await provider.extract(pages.map((p,n)=>({text:p.raw_ai_text,page:n+1})));
    rpcResult(await client.rpc("finish_document_run",{p_run_id:id,p_extraction:extraction,p_token:claim.token}));
    return Response.json({complete:true},{headers});
  } catch(error) {
    if(active)await active.client.rpc("set_document_run_state",{p_run_id:active.id,p_resume:false,p_error:"document_processing_failed"});
    const safe=error instanceof BackendError?safeError(error):new BackendError(503,"Document processing was interrupted. Saved page drafts remain in history; review them before retrying.");
    return Response.json({error:safe.message},{status:safe.status,headers});
  }
}
