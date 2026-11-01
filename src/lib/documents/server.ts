import "server-only";
import { createHash } from "node:crypto";
import type { SupabaseClient } from "@supabase/supabase-js";
import { allRows } from "../backend/catalogue";
import { BackendError } from "../backend/errors";
import { convertPreview } from "../preview/convert";
import type { DocumentRun, DocumentPageText } from "./types";
export async function documentBody(request: Request) {
  const reader=request.body?.getReader();
  if (!reader) throw new BackendError(400,"Choose a document action.");
  let text="",size=0;
  const decoder=new TextDecoder();
  try {
    for (;;) {
      const next=await reader.read();if(next.done)break;
      size+=next.value.byteLength;
      if(size>4096){await reader.cancel();throw new BackendError(413,"Document request is too large.");}
      text+=decoder.decode(next.value,{stream:true});
    }
    text+=decoder.decode();return JSON.parse(text) as Record<string,unknown>;
  } catch(error) {if(error instanceof BackendError)throw error;throw new BackendError(400,"Invalid document request.");}
}
export async function documentRun(client: SupabaseClient,id: string) {
  const {data,error}=await client.from("document_runs").select("*").eq("id",id).maybeSingle();
  if(error || !data)throw new BackendError(404,"Document attempt not found.");
  return data as DocumentRun;
}
export async function runPages(client: SupabaseClient,runId: string) {
  return (await allRows<DocumentPageText>((from,to)=>client.from("transcriptions").select("*",{count:"exact"}).eq("document_run_id",runId).order("page_order_snapshot").order("id").range(from,to).retry(false),p=>p.id)).data;
}
const hash=(bytes:Uint8Array)=>createHash("sha256").update(bytes).digest("hex");
export async function documentPageImage(client: SupabaseClient,run:DocumentRun,fileId:string) {
  const source=run.source_manifest.find(p=>p.id===fileId);
  if(!source)throw new BackendError(400,"Page not in this attempt.");
  const {data:original,error}=await client.from("archive_item_files").select("*").eq("id",fileId).eq("archive_id",run.archive_id).eq("item_id",run.item_id).eq("purpose","original").eq("status","stored").maybeSingle();
  if(error || !original || original.sha256!==source.sha256)throw new BackendError(409,"Document sources changed. Reload before processing.");
  const {data:set}=await client.from("current_image_sets").select("display_file_id").eq("original_file_id",fileId).maybeSingle();
  if(set) {
    const {data:derived}=await client.from("archive_item_files").select("*").eq("id",set.display_file_id).eq("parent_original_id",fileId).eq("item_id",run.item_id).eq("status","stored").maybeSingle();
    if(derived) {
      const {data,error:downloadError}=await client.storage.from(derived.bucket_id).download(derived.storage_path,{}, {signal:AbortSignal.timeout(15000)});
      if(!data || downloadError || data.size>10485760)throw new BackendError(503,"Page image unavailable.");
      const bytes=new Uint8Array(await data.arrayBuffer());
      if(hash(bytes)!==derived.sha256 || derived.mime_type!=="image/jpeg")throw new BackendError(409,"Page integrity check failed.");
      return {url:`data:image/jpeg;base64,${Buffer.from(bytes).toString("base64")}`,provenance:{original_file_id:fileId,original_sha256:source.sha256,input_file_id:derived.id,input_sha256:hash(bytes)}};
    }
  }
  const {data,error:downloadError}=await client.storage.from(original.bucket_id).download(original.storage_path,{}, {signal:AbortSignal.timeout(15000)});
  if(!data || downloadError || data.size>30*1024*1024)throw new BackendError(503,"Original page unavailable.");
  const bytes=new Uint8Array(await data.arrayBuffer());
  if(hash(bytes)!==source.sha256)throw new BackendError(409,"Original integrity check failed.");
  const converted=await convertPreview(bytes);
  return {url:`data:image/jpeg;base64,${Buffer.from(converted.bytes).toString("base64")}`,provenance:{original_file_id:fileId,original_sha256:source.sha256,input_file_id:null,input_sha256:hash(converted.bytes)}};
}
export function rpcResult<T>(result:{data:T;error:{code?:string;message:string}|null}):T {
  if(result.error)throw new BackendError(result.error.code==="42501"?403:409,
    result.error.message.includes("busy")?"This document is already processing. Wait before retrying.":"Document processing could not continue. Reload to review the current pages and permissions.");
  return result.data;
}
