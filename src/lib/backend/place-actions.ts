"use server";
import { revalidatePath } from "next/cache";
import { requireSession } from "./repository";
import { safeError } from "./errors";
import { UUID_PATTERN } from "./validation";
export async function placeAction(archiveId: string, form: FormData) {
  try {
    if (!UUID_PATTERN.test(archiveId)) return { error: "Invalid archive." };
    const read = (key: string) => String(form.get(key) || "").trim();
    const action = read("action"),
      itemId = read("itemId"),
      placeId = read("placeId"),
      linkId = read("linkId");
    if (["link", "create_link"].includes(action) && !UUID_PATTERN.test(itemId))
      return { error: "Invalid item." };
    if (action === "link" && !UUID_PATTERN.test(placeId))
      return { error: "Select a Place in this archive." };
    if (["remove", "confirm"].includes(action) && !UUID_PATTERN.test(linkId))
      return { error: "Invalid association." };
    if (action === "save" && placeId && !UUID_PATTERN.test(placeId))
      return { error: "Invalid Place." };
    const details = Object.fromEntries(
      [
        "name",
        "locality",
        "city",
        "region",
        "country",
        "latitude",
        "longitude",
        "notes",
      ].map((k) => [k, read(k)]),
    );
    const { client } = await requireSession();
    let result;
    if (action === "save")
      result = await client.rpc("save_archive_place", {
        p_archive_id: archiveId,
        p_place_id: placeId || null,
        p_details: details,
      });
    else if (action === "link")
      result = await client.rpc("link_item_place", {
        p_archive_id: archiveId,
        p_item_id: itemId,
        p_place_id: placeId,
        p_role: "primary",
        p_from_report: read("fromReport") === "yes",
      });
    else if (action === "create_link")
      result = await client.rpc("create_item_place", {
        p_archive_id: archiveId,
        p_item_id: itemId,
        p_details: details,
        p_from_report: read("fromReport") === "yes",
      });
    else if (action === "remove" || action === "confirm")
      result = await client.rpc("review_item_place", {
        p_link_id: linkId,
        p_action: action,
      });
    else return { error: "Unknown Place action." };
    if (result.error)
      return {
        error:
          "The Place was not changed. Check your archive permissions or retry shortly.",
      };
    revalidatePath("/", "layout");
    return {
      ok: true,
      id: typeof result.data === "string" ? result.data : undefined,
    };
  } catch (error) {
    return { error: safeError(error).message };
  }
}
