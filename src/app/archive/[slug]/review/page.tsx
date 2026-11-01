import { loadItem } from "@/lib/backend/repository";
import { documentState } from "@/lib/documents/repository";
import { loadPlaceData } from "@/lib/backend/places";
import { documentKinds } from "@/lib/documents/types";
import { DocumentReview } from "@/components/live/document-review";
import { can } from "@/lib/permissions";
import { isDemoMode } from "@/lib/supabase/config";
import Link from "next/link";
import { notFound } from "next/navigation";
import { items } from "@/lib/data";
import { TranscriptionReview } from "@/components/transcription-review";
export const metadata = { title: "Letter transcription review" };
export default async function ReviewPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{run?:string}>;
}) {
  const { slug } = await params;
  if (!isDemoMode()) {
    const result=await loadItem(slug);if(!result || !documentKinds.includes(result.item.kind))notFound();
    const data=await documentState(slug,(await searchParams).run).catch(()=>null);
    if(!data)return <div className="page-shell"><h1>Document reading</h1><p>Document processing could not load. The original pages remain available. An archive administrator may need to finish the document-processing setup.</p><Link href={`/archive/${slug}`}>Back to item ↗</Link></div>;
    const {snapshot,item}=result;
    const role=snapshot.members.find(m=>m.profileId===snapshot.profileId&&m.status==="active")?.role||"viewer";
    const places=await loadPlaceData(item.archive_id).catch(()=>({places:[],links:[]}));
    return <div className="page-shell"><DocumentReview key={data.run?.id||"unprocessed"} archiveId={item.archive_id} itemId={item.id} kind={item.kind} title={item.title||"A letter, in its own words."}
      files={result.files.filter(f=>f.purpose==="original")} sets={result.imageSets} {...data} editor={can(role,"editor")}
      canProcess={item.lifecycle==="active"&&item.ingestion_status==="ready"&&!item.archived_at&&(can(role,"editor")||(can(role,"contributor")&&item.contributed_by===snapshot.profileId&&item.evidence_status!=="verified"))}
      people={snapshot.people} places={places.places} date={item.reported_date||""} precision={item.date_precision||"unknown"}/></div>;
  }
  const item = items.find((i) => i.slug === slug && i.kind === "Letter");
  if (!item) notFound();
  return (
    <div className="page-shell">
      <div className="breadcrumb">
        <Link href={`/archive/${item.slug}`}>{item.title}</Link>
        <span>/</span>
        <span>Transcription review</span>
      </div>
      <h1 className="review-page-title">A letter, in its own words.</h1>
      <TranscriptionReview itemId={item.id} />
    </div>
  );
}
