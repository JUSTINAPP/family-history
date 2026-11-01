"use server";
import { revalidatePath } from "next/cache";
import { requireSession } from "./repository";
import { safeError } from "./errors";
import { UUID_PATTERN } from "./validation";
const errors: Record<string, string> = {
  cross_item_source_dependency:
    "Another item's transcription depends on this source. Resolve that dependency before deletion; no files were removed.",
  permission_denied: "Editor or Admin access is required.",
  preview_busy:
    "A preview is processing. Wait for it to finish, then try again.",
  preview_recently_active:
    "A preview recently ran. Wait 75 seconds before permanent deletion.",
  split_context_has_children:
    "Keep this context record while its separated photographs exist. Review those items first.",
  archive_before_delete:
    "Archive the item before requesting permanent deletion.",
  unreviewed_dependency:
    "A newer database dependency needs review before deletion. No files have been removed.",
  item_changed_review_again:
    "The item changed. Reload and review its current contents before confirming.",
  confirmation_or_version_required:
    "Reload and review the current item before confirming.",
  cross_item_audio_dependency:
    "A recording depends on another item's material. Resolve that link before deleting.",
  item_state_conflict:
    "This item is a split context record or deletion is already in progress.",
  not_a_grouped_photograph:
    "Only a legacy photograph item containing multiple originals can be split.",
};
export async function manageItemAction(form: FormData) {
  try {
    const id = String(form.get("itemId") || ""),
      action = String(form.get("action") || "");
    if (!UUID_PATTERN.test(id)) return { error: "Invalid item." };
    const { client } = await requireSession();
    let result: {
      data: unknown;
      error: { message: string; code?: string } | null;
    };
    if (action === "archive" || action === "restore")
      result = await client.rpc("set_item_archived", {
        p_item_id: id,
        p_archived: action === "archive",
      });
    else if (action === "split") {
      if (
        form.get("confirmation") !== "SPLIT" ||
        form.get("acknowledge") !== "yes"
      )
        return {
          error: "Type SPLIT and acknowledge how the context will be retained.",
        };
      result = await client.rpc("split_photographs", {
        p_item_id: id,
        p_version: String(form.get("version") || ""),
        p_confirmation: "SPLIT",
      });
    } else if (action === "delete") {
      if (
        form.get("confirmation") !== "DELETE" ||
        form.get("acknowledge") !== "yes"
      )
        return {
          error:
            "Type DELETE and explicitly confirm removal of all listed material.",
        };
      const { data: plan, error } = await client.rpc("begin_item_deletion", {
        p_item_id: id,
        p_version: String(form.get("version") || ""),
        p_confirmation: "DELETE",
      });
      if (error)
        return {
          error:
            errors[error.message] ||
            "Deletion could not start. Reload and review permissions and dependencies.",
        };
      const groups = new Map<string, string[]>();
      const manifest = plan.manifest as {
        id: string;
        bucket: string;
        path: string;
      }[];
      for (const file of (plan.remaining || manifest) as {
        bucket: string;
        path: string;
      }[])
        groups.set(file.bucket, [
          ...(groups.get(file.bucket) || []),
          file.path,
        ]);
      for (const [bucket, paths] of groups)
        for (let start = 0; start < paths.length; start += 100) {
          const { error: storageError } = await client.storage
            .from(bucket)
            .remove(paths.slice(start, start + 100));
          if (storageError) {
            revalidatePath("/", "layout");
            return {
              error:
                "Deletion is in progress. Some files could not be removed. Retry permanent deletion here; metadata is retained until Storage cleanup succeeds.",
            };
          }
          const removed = new Set(paths.slice(start, start + 100));
          const { error: checkpointError } = await client.rpc(
            "checkpoint_item_deletion",
            {
              p_deletion_id: plan.id,
              p_file_ids: manifest
                .filter((f) => f.bucket === bucket && removed.has(f.path))
                .map((f) => f.id),
            },
          );
          if (checkpointError)
            return {
              error:
                "Storage cleanup needs verification. Deletion remains in progress; reload and retry to resume its checkpoint.",
            };
        }
      const finished = await client.rpc("finish_item_deletion", {
        p_deletion_id: plan.id,
      });
      if (finished.error)
        return {
          error:
            "Storage cleanup finished, but database cleanup needs a retry. Deletion remains in progress; return here to finish it.",
        };
      revalidatePath("/", "layout");
      return { deleted: true, archiveId: String(finished.data) };
    } else return { error: "Unknown management action." };
    if (result.error)
      return {
        error:
          errors[result.error.message] ||
          "The operation could not complete. Reload and check your archive access.",
      };
    revalidatePath("/", "layout");
    return { ok: true };
  } catch (error) {
    return { error: safeError(error).message };
  }
}
