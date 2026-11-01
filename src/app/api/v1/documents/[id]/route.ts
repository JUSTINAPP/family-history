import { requireSession } from "@/lib/backend/repository";
import { BackendError, safeError } from "@/lib/backend/errors";
import { UUID_PATTERN } from "@/lib/backend/validation";
import { isSameOriginRequest } from "@/lib/backend/request-origin";
import { documentProvider } from "@/lib/documents/provider";
import { documentBody, rpcResult } from "@/lib/documents/server";
export const runtime="nodejs";
const headers={"Cache-Control":"private, no-store"};
export async function POST(request:Request,{params}:{params:Promise<{id:string}>}) {
  try {
    if(!isSameOriginRequest(request))throw new BackendError(403,"Request origin denied.");
    const {client}=await requireSession();
    const {id}=await params;
    if(!UUID_PATTERN.test(id))throw new BackendError(404,"Document not found.");
    const snapshot=await client.rpc("document_snapshot",{p_item_id:id});rpcResult(snapshot);
    const provider=documentProvider();
    if(!provider)throw new BackendError(503,"AI transcription is not configured. An archive administrator can enable it later; your originals are already preserved.");
    const body=await documentBody(request);
    if(!UUID_PATTERN.test(String(body.requestId || "")) || !["transcribe","translate"].includes(String(body.operation)) ||
      (body.sourceRunId && !UUID_PATTERN.test(String(body.sourceRunId))))throw new BackendError(400,"Choose a document operation.");
    const run=rpcResult(await client.rpc("begin_document_run",{
      p_item_id:id,p_request_id:body.requestId,p_version:body.version,p_operation:body.operation,
      p_source_run_id:body.sourceRunId || null,p_provider:provider.name,p_model:provider.model,
    }));
    return Response.json({id:run.id,pages:run.source_manifest,status:run.status},{headers});
  } catch(error) {const safe=safeError(error);return Response.json({error:safe.message},{status:safe.status,headers});}
}
