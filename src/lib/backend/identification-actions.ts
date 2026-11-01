"use server";
import { revalidatePath } from "next/cache";
import { requireSession } from "./repository";
import { safeError } from "./errors";
import { UUID_PATTERN } from "./validation";

export async function identifyPersonAction(
  archiveId: string,
  itemId: string,
  form: FormData,
) {
  try {
    if (!UUID_PATTERN.test(archiveId) || !UUID_PATTERN.test(itemId))
      return { error: "Invalid archive item." };
    const { client } = await requireSession();
    const read = (key: string) => String(form.get(key) || "").trim();
    const action = read("action"),
      personId = read("personId"),
      identificationId = read("identificationId");
    if (["add", "link"].includes(action) && !UUID_PATTERN.test(personId))
      return { error: "Select a Person from this archive." };
    if (
      ["link", "confirm", "remove"].includes(action) &&
      !UUID_PATTERN.test(identificationId)
    )
      return { error: "Invalid identification." };
    let result;
    if (action === "add" || action === "report")
      result = await client.rpc("propose_identification", {
        p_archive_id: archiveId,
        p_item_id: itemId,
        p_person_id: action === "add" ? personId : null,
        p_name: read("name"),
      });
    else if (action === "link")
      result = await client.rpc("link_identification", {
        p_identification_id: identificationId,
        p_person_id: personId,
      });
    else if (action === "confirm" || action === "remove")
      result = await client.rpc("review_identification", {
        p_identification_id: identificationId,
        p_action: action,
      });
    else if (action === "create")
      result = await client.rpc("create_identified_person", {
        p_archive_id: archiveId,
        p_item_id: itemId,
        p_name: read("name"),
        p_category: read("category") || "other",
      });
    else return { error: "Unknown identification action." };
    if (result.error)
      return {
        error:
          "The identification was not changed. Check your archive permissions and migration 010, then retry.",
      };
    revalidatePath("/", "layout");
    return { ok: true };
  } catch (error) {
    return { error: safeError(error).message };
  }
}
