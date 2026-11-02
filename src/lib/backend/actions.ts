"use server";
import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";
import { requireArchiveRole, requireSession } from "./repository";
import { safeError } from "./errors";
import type { Archive, Member } from "@/lib/workspace-types";
export async function createArchiveAction(form: FormData) {
  void form;
  return { error: "This site uses the shared Sydney & Auroville archive. Contact Jonas for access.", id: undefined };
}
export async function selectArchiveAction(id: string) {
  try {
    await requireArchiveRole(id);
    (await cookies()).set("active_archive", id, {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      path: "/",
    });
    revalidatePath("/", "layout");
    return null;
  } catch (error) {
    return safeError(error).message;
  }
}
export async function saveArchiveAction(archive: Archive) {
  try {
    const { client } = await requireArchiveRole(archive.id, "admin");
    const { data: existing } = await client
      .from("archives")
      .select("cover_file_id")
      .eq("id", archive.id)
      .single();
    const { error } = await client.rpc("update_archive", {
      p_archive_id: archive.id,
      p_name: archive.name,
      p_slug: archive.slug,
      p_description: archive.description,
      p_privacy: archive.privacy,
      p_settings: archive.settings,
      p_cover_file_id: existing?.cover_file_id || null,
    });
    if (error)
      return "Settings could not be saved. Check the name, slug and your archive access.";
    revalidatePath("/", "layout");
    return null;
  } catch (error) {
    return safeError(error).message;
  }
}
export async function manageMemberAction(
  archiveId: string,
  id: string,
  patch: Partial<Pick<Member, "role" | "status" | "linkedPersonId">>,
) {
  try {
    const { client } = await requireArchiveRole(archiveId, "admin");
    const { data: member } = await client
      .from("archive_memberships")
      .select("*")
      .eq("archive_id", archiveId)
      .eq("id", id)
      .single();
    if (!member) return "Member not found.";
    const { error } = await client.rpc("manage_member", {
      p_archive_id: archiveId,
      p_member_id: id,
      p_role: patch.role || member.role,
      p_status: patch.status || member.status,
      p_person_id:
        patch.linkedPersonId === undefined
          ? member.linked_person_id
          : patch.linkedPersonId,
    });
    if (error)
      return "Access was not changed. The owner must remain an active admin, and linked people must belong to this archive.";
    revalidatePath("/", "layout");
    return null;
  } catch (error) {
    return safeError(error).message;
  }
}
export async function savePersonAction(archiveId: string, form: FormData) {
  try {
    const { client } = await requireArchiveRole(archiveId, "editor");
    const { error } = await client.rpc("save_person", {
      p_archive_id: archiveId,
      p_name: String(form.get("name") || ""),
      p_category: String(form.get("category") || "other"),
      p_biography: String(form.get("biography") || ""),
      p_lifespan: String(form.get("lifespan") || ""),
    });
    if (error)
      return "The person could not be saved. Check their name and your archive permissions.";
    revalidatePath("/", "layout");
    return null;
  } catch (error) {
    return safeError(error).message;
  }
}
export async function addRecollectionAction(
  archiveId: string,
  itemId: string,
  text: string,
) {
  try {
    const { client } = await requireArchiveRole(archiveId, "commenter");
    const { error } = await client.rpc("add_recollection", {
      p_archive_id: archiveId,
      p_item_id: itemId,
      p_text: text,
    });
    if (error) return "The recollection could not be saved. Please try again.";
    revalidatePath("/", "layout");
    return null;
  } catch (error) {
    return safeError(error).message;
  }
}

export async function catalogueItemAction(
  archiveId: string,
  itemId: string,
  form: FormData,
) {
  try {
    const { client } = await requireSession();
    const read = (name: string) => String(form.get(name) || "").trim();
    let { error } = await client.rpc("save_catalogue_context", {
      p_archive_id: archiveId,
      p_item_id: itemId,
      p_write_id: read("writeId"),
      p_recollection: read("newRecollection"),
      p_details: {
        title: read("title"),
        kind: read("kind"),
        notes: read("notes"),
        people: read("people"),
        date: read("date"),
        precision: read("precision"),
        place: read("place"),
      },
    });
    if (error && ["PGRST202", "42883"].includes(error.code)) {
      if (read("newRecollection"))
        return {
          error:
            "Your words are still on this page. Save this recollection from the item page, or finish the catalogue setup first.",
        };
      const fallback = await client.rpc("catalogue_item", {
        p_archive_id: archiveId,
        p_item_id: itemId,
        p_title: read("title"),
        p_kind: read("kind"),
        p_notes: read("notes"),
        p_people: read("people"),
        p_date: read("date"),
        p_precision: read("precision"),
        p_place: read("place"),
      });
      error = fallback.error;
    }
    if (error)
      return {
        error:
          "Changes were not saved. Check your archive access and that the latest migration is applied.",
      };
    revalidatePath("/", "layout");
    return { saved: true };
  } catch (error) {
    return { error: safeError(error).message };
  }
}

export async function suggestIdentificationAction(
  archiveId: string,
  itemId: string,
  name: string,
) {
  try {
    if (!name.trim() || name.trim().length > 200)
      return "Enter a name or identification up to 200 characters.";
    const { client } = await requireArchiveRole(archiveId, "commenter");
    const { error } = await client.rpc("propose_identification", {
      p_archive_id: archiveId,
      p_item_id: itemId,
      p_person_id: null,
      p_name: name.trim(),
    });
    if (error)
      return "The identification could not be saved. Please try again.";
    revalidatePath("/", "layout");
    return null;
  } catch (error) {
    return safeError(error).message;
  }
}
