"use server";
import { loadWorkspace, requireSession } from "./repository";
import { loadPlaceData } from "./places";
import { quickContext } from "./quick-catalogue";
import { loadRecordings } from "../audio/repository";
import { UUID_PATTERN } from "./validation";

export async function loadCardDetails(archiveId: string, itemId: string) {
  try {
    if (![archiveId, itemId].every(id => UUID_PATTERN.test(id))) throw new Error();
    const snapshot = await loadWorkspace({materialOnly: true, archiveId});
    const item = snapshot?.catalogue.find(item => item.id === itemId && !item.archivedAt && item.ingestionStatus === "ready");
    if (!snapshot || snapshot.archive.id !== archiveId || !item || !snapshot.peopleLinksAvailable) throw new Error();
    const {client} = await requireSession();
    const [context, places, recordings, record, sources] = await Promise.all([
      quickContext(archiveId, [itemId]), loadPlaceData(archiveId, itemId), loadRecordings(client, archiveId, itemId).then(recordings=>({recordings,error:""})).catch(()=>({recordings:[],error:"Saved recordings could not load. Retry to see them."})),
      client.from("archive_items").select("id,archive_id,title,kind,notes,people_text,reported_date,date_precision,reported_place,lifecycle,ingestion_status,archived_at,grouping_kind").eq("archive_id",archiveId).eq("id",itemId).single(),
      client.from("archive_item_files").select("id,presentation_rotation").eq("archive_id",archiveId).eq("item_id",itemId).eq("purpose","original").eq("status","stored"),
    ]);
    if(record.error || sources.error) throw new Error();
    const role = snapshot.members.find(member => member.profileId === snapshot.profileId && member.status === "active")?.role || "viewer";
    return {data: {item, editorItem: record.data, sources: sources.data || [], people: snapshot.people, identifications: context.identifications, places: places.places, links: places.links,
      recordings: recordings.recordings, recordingsError: recordings.error, role, profileId: snapshot.profileId,
      editable: ["editor", "admin"].includes(role) || (role === "contributor" && item.contributedBy === snapshot.profileId && item.certainty !== "verified")}};
  } catch {return {error: "Details could not load. Please retry."};}
}
