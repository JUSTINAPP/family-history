import "server-only";
import { requireSession } from "./repository";
import { allRows } from "./catalogue";
import type { Identification } from "../identifications";
import type { FamilyComment } from "../conversation";
export async function quickContext(archiveId: string, itemIds: string[]) {
  if (!itemIds.length) return {identifications: [], comments: []};
  const {client} = await requireSession();
  const [people, comments] = await Promise.all([
    allRows<Identification>((from, to) => client.from("identifications").select("id,archive_id,item_id,person_id,proposed_name,proposed_by,created_at,status", {count: "exact"})
      .eq("archive_id", archiveId).in("item_id", itemIds).order("id").range(from,to).retry(false).abortSignal(AbortSignal.timeout(5000)), r => r.id),
    allRows<FamilyComment>((from, to) => client.from("comments").select("id,archive_id,item_id,author_id,body,created_at,edited_at,archived_at,parent_id,revision", {count: "exact"})
      .eq("archive_id", archiveId).in("item_id", itemIds).order("created_at").order("id").range(from,to).retry(false).abortSignal(AbortSignal.timeout(5000)), r => r.id),
  ]);
  return {identifications: people.data, comments: comments.data};
}
