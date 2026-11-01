import Link from "next/link";
import {requireSession} from "@/lib/backend/repository";
import {documentProvider} from "@/lib/documents/provider";
export async function DocumentActions({itemId,kind,canProcess}:{itemId:string;kind:string;canProcess:boolean}) {
  const {client}=await requireSession();
  const {data:run}=await client.from("document_runs").select("id").eq("item_id",itemId).eq("operation","transcribe").order("created_at",{ascending:false}).limit(1).maybeSingle();
  const href=`/archive/${itemId}/review${run?`?run=${run.id}`:""}`;
  return <section className="document-actions" aria-label="Document transcription">
    <div className="import-actions">{run&&<Link className="button" prefetch={false} href={href}>View transcription</Link>}
      {canProcess&&<Link className={run?"text-link":"button"} prefetch={false} href={href}>{run?"Transcribe again":kind==="Letter"?"Transcribe letter":"Transcribe document"}</Link>}
      {!canProcess&&!run&&<Link className="text-link" href={href}>Transcription and translation ↗</Link>}
    </div>
    <p>Use AI to create an editable transcription. The original remains unchanged. You choose whether to process these pages.</p>
    {canProcess&&!documentProvider()&&<p className="help-line">AI transcription is not configured yet. Your pages are preserved and can be processed later.</p>}
  </section>;
}
