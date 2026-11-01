"use server";
import { revalidatePath } from "next/cache";
import { requireArchiveRole } from "./repository";
import { managementSnapshot } from "./item-management";
import { UUID_PATTERN } from "./validation";

/** Editors deliberately re-report selected context; original evidence stays on the source item. */
export async function copySharedContext(form: FormData) {
  const read = (key: string) => String(form.get(key) || "");
  const source = read("source"), target = read("target"), id = read("id"), kind = read("kind");
  if (![source, target, id].every(value => UUID_PATTERN.test(value)) || !["recollection", "person"].includes(kind))
    return { error: "Choose a note and a photograph." };
  try {
    const snapshot = await managementSnapshot(source);
    const { client } = await requireArchiveRole(snapshot.item.archive_id, "editor");
    if (snapshot.item.grouping_kind !== "split_context" || !snapshot.children.some(c => c.id === target))
      return { error: "Choose one of the photographs separated from these notes." };
    let error;
    if (kind === "person") {
      const record = await client.from("identifications").select("person_id,proposed_name,status")
        .eq("archive_id", snapshot.item.archive_id).eq("item_id", source).eq("id", id).maybeSingle();
      if (record.error || !record.data?.person_id || !["reported", "accepted"].includes(record.data.status))
        return { error: "That Person association is no longer available." };
      ({ error } = await client.rpc("propose_identification", {
        p_archive_id: snapshot.item.archive_id, p_item_id: target,
        p_person_id: record.data.person_id, p_name: record.data.proposed_name,
      }));
    } else {
      const record = await client.from("recollections").select("original_text,recorded_at,contributor_id")
        .eq("archive_id", snapshot.item.archive_id).eq("item_id", source).eq("id", id).maybeSingle();
      if (record.error || !record.data?.original_text?.trim())
        return { error: "That written recollection is no longer available." };
      // Explicit attribution survives export; the original contributor, timestamp and source remain untouched.
      const text = `Earlier shared recollection${record.data.recorded_at ? ` (recorded ${record.data.recorded_at})` : ""}:\n${record.data.original_text}`;
      const existing = await client.from("recollections").select("id").eq("item_id", target).eq("original_text", text).limit(1);
      if (existing.error) return { error: "Could not check the photograph's notes. Please retry." };
      if (!existing.data?.length)
        ({ error } = await client.rpc("add_recollection", {p_archive_id: snapshot.item.archive_id, p_item_id: target, p_text: text}));
    }
    if (error) return { error: "The selected context could not be copied. Reload and check the photograph is available." };
    revalidatePath("/", "layout");
    return { ok: true };
  } catch {
    return { error: "Shared notes are unavailable. Editor access is required." };
  }
}
