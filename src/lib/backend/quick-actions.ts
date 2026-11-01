"use server";
import { revalidatePath } from "next/cache";
import { requireSession } from "./repository";
import { UUID_PATTERN } from "./validation";
export async function saveQuickField(archiveId: string, itemId: string, form: FormData) {
  if (![archiveId, itemId].every(v => UUID_PATTERN.test(v))) return {error: "Invalid item."};
  try {
    const {client} = await requireSession();
    const {error} = await client.rpc("save_item_field", {
      p_archive_id: archiveId, p_item_id: itemId, p_field: String(form.get("field") || ""),
      p_value: String(form.get("value") || ""), p_precision: String(form.get("precision") || "unknown"),
      p_expected: JSON.parse(String(form.get("expected") || "null")),
    });
    if (error) return {error: error.code === "40001" ? "This field changed. Reload to review it before saving." : "Could not save. Check the value and your permission to edit this item."};
    revalidatePath("/", "layout");
    return {ok: true};
  } catch { return {error: "Could not save. Your changes are still here; please retry."}; }
}
export async function conversationAction(archiveId: string, itemId: string, form: FormData) {
  const read = (key: string) => String(form.get(key) || "");
  const action = read("action"), id = read("commentId"), parent = read("parentId"), write = read("writeId");
  if (![archiveId, itemId].every(v => UUID_PATTERN.test(v)) ||
    (action !== "post" && !UUID_PATTERN.test(id)) || (parent && !UUID_PATTERN.test(parent)) || (action === "post" && !UUID_PATTERN.test(write)))
    return {error: "Invalid comment."};
  try {
    const {client} = await requireSession();
    let result;
    if (action === "post") result = await client.rpc("post_item_comment", {
      p_archive_id: archiveId, p_item_id: itemId, p_body: read("body"), p_parent_id: parent || null, p_write_id: write,
    });
    else {
      // Bind all existing-comment actions to the visible item as well as the RPC's own role checks.
      const row = await client.from("comments").select("id").eq("archive_id", archiveId).eq("item_id", itemId).eq("id", id).maybeSingle();
      if (row.error || !row.data) return {error: "That comment is no longer available."};
      if (action === "promote") result = await client.rpc("promote_item_comment", {p_comment_id: id, p_revision: Number(read("revision"))});
      else if (["edit", "archive", "restore"].includes(action)) result = await client.rpc("change_item_comment", {
        p_comment_id: id, p_action: action, p_body: read("body"), p_revision: Number(read("revision")),
      });
      else return {error: "Unknown comment action."};
    }
    if (result.error) return {error: result.error.code === "40001" ? "This comment changed. Reload before editing it." : result.error.message === "comment_retry_conflict" ? "An earlier version may already be saved. Reload to review it before posting changed text." : "Comment not saved. Check your access and retry; your words are still here."};
    const target=action === "post" ? result.data : id;
    const saved=await client.from("comments").select("id,archive_id,item_id,author_id,body,created_at,edited_at,archived_at,parent_id,revision")
      .eq("archive_id",archiveId).eq("item_id",itemId).eq("id",target).maybeSingle();
    if(saved.error||!saved.data)return {error:"Your change may be saved. Reload the conversation before retrying."};
    return {ok: true,comment:saved.data as import("../conversation").FamilyComment};
  } catch { return {error: "Comment not saved. Check your connection and retry."}; }
}
