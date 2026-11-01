import "server-only";
import {readingOutput} from "./reading-output";
import { requireSession } from "../backend/repository";
import { allRows } from "../backend/catalogue";
import { documentProvider } from "./provider";
import { rpcResult, runPages } from "./server";
import type { DocumentRun, DocumentRunSummary, DocumentSuggestion, DocumentPageText } from "./types";
export interface StoredDocumentSuggestion {
  id: string; document_run_id: string; source_file_id: string; status: string;
  suggested_value: DocumentSuggestion; reviewed_value: {value?:string;canonical_id?:string;context?:string;text_only?:boolean;precision?:string}|null;
}
export async function documentState(itemId:string, selected?:string) {
  const {client}=await requireSession();
  const [snapshot,runs]=await Promise.all([
    client.rpc("document_snapshot",{p_item_id:itemId}),
    allRows<DocumentRunSummary>((from,to)=>client.from("document_runs").select("id,item_id,archive_id,source_version,source_manifest,source_run_id,operation,status,provider,model,error_code,created_at,updated_at",{count:"exact"}).eq("item_id",itemId).order("created_at",{ascending:false}).order("id").range(from,to).retry(false),r=>r.id),
  ]);
  const source=rpcResult(snapshot) as {version:string;pages:import("./types").DocumentSource[]};
  const chosen=selected?runs.data.find(r=>r.id===selected):runs.data[0];
  let run:DocumentRun|null=null,pages:DocumentPageText[]=[],suggestions:StoredDocumentSuggestion[]=[];
  if(chosen){
    const [record,readings,drafts]=await Promise.all([
      client.from("document_runs").select("*").eq("item_id",itemId).eq("id",chosen.id).single(),
      runPages(client,chosen.id),
      allRows<StoredDocumentSuggestion>((from,to)=>client.from("metadata_suggestions").select("id,document_run_id,source_file_id,status,suggested_value,reviewed_value",{count:"exact"}).eq("document_run_id",chosen.id).order("id").range(from,to).retry(false),s=>s.id),
    ]);
    const persisted=rpcResult(record) as DocumentRun;
    run={...persisted,output:readingOutput(persisted.output)};pages=readings;suggestions=drafts.data;
  }
  return {source,runs:runs.data,run,pages,suggestions,configured:!!documentProvider()};
}
export async function reviewedDocumentSearch(archiveId:string) {
  const {client}=await requireSession();
  const rows=await allRows<{id:string;item_id:string;original_file_id:string;reviewed_text:string}>((from,to)=>client.from("transcriptions").select("id,item_id,original_file_id,reviewed_text",{count:"exact"})
    .eq("archive_id",archiveId).eq("modality","handwriting").eq("output_kind","source").eq("review_status","reviewed").not("reviewed_text","is",null)
    .order("reviewed_at",{ascending:false}).order("id").range(from,to).retry(false).abortSignal(AbortSignal.timeout(3000)),r=>r.id);
  const seen=new Set<string>(),text=new Map<string,string[]>();
  for(const r of rows.data)if(!seen.has(r.original_file_id)){seen.add(r.original_file_id);text.set(r.item_id,[...(text.get(r.item_id)||[]),r.reviewed_text]);}
  return text;
}
