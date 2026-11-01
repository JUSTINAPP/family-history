import { requireSession } from "@/lib/backend/repository";
export async function ReviewedDocumentNotes({itemId,archiveId}:{itemId:string;archiveId:string}) {
  const {client}=await requireSession();
  const {data,error}=await client.from("metadata_suggestions").select("field_path,reviewed_value,reviewed_at").eq("archive_id",archiveId).eq("item_id",itemId).eq("status","accepted").in("field_path",["document.summary","document.topic"]).order("reviewed_at",{ascending:false}).limit(30).retry(false);
  if(error || !data?.length)return null;
  const summary=data.find(s=>s.field_path==="document.summary")?.reviewed_value?.value;
  const topics=[...new Set(data.filter(s=>s.field_path==="document.topic").map(s=>s.reviewed_value?.value).filter(Boolean))];
  return <section>{summary && <><h2>About this {"letter"}</h2><p className="prose">{summary}</p></>}{!!topics.length&&<p className="help-line">Topics: {topics.join(" · ")}</p>}</section>;
}
