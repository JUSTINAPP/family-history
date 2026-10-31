import { createHash } from "node:crypto";
import type { SupabaseClient } from "@supabase/supabase-js";
import { BackendError } from "./errors";
import { imageMime, MAX_ORIGINAL_BYTES, UUID_PATTERN } from "./validation";
export async function persistUpload(client: SupabaseClient, form: FormData) {
  const archiveId = String(form.get("archiveId") || "");
  const captureId = String(form.get("captureId") || "");
  if (!UUID_PATTERN.test(archiveId) || !UUID_PATTERN.test(captureId))
    throw new BackendError(400, "Choose an archive and try the capture again.");
  const { data: allowed, error: permissionError } = await client.rpc(
    "can_access_archive",
    { p_archive_id: archiveId, p_minimum: "contributor" },
  );
  if (permissionError)
    throw new BackendError(
      503,
      "Archive permissions could not be checked. Apply the migrations or try again.",
    );
  if (!allowed)
    throw new BackendError(
      403,
      "Contributor access is required to save material in this archive.",
    );
  const sources = form.getAll("files");
  if (!sources.length || sources.length > 20)
    throw new BackendError(400, "Choose between 1 and 20 images per capture.");
  const prepared = [];
  let total = 0;
  for (const source of sources) {
    if (
      !(source instanceof File) ||
      !source.size ||
      source.size > MAX_ORIGINAL_BYTES
    )
      throw new BackendError(
        400,
        "Each image must be between 1 byte and 30 MB.",
      );
    total += source.size;
    if (total > 80 * 1024 * 1024)
      throw new BackendError(400, "Keep each capture below 80 MB.");
    const bytes = Buffer.from(await source.arrayBuffer());
    const mimeType = imageMime(bytes);
    if (!mimeType)
      throw new BackendError(
        400,
        "Choose a valid JPEG, PNG, WebP or HEIC image. The source file was not changed.",
      );
    prepared.push({
      source,
      bytes,
      mimeType,
      sha256: createHash("sha256").update(bytes).digest("hex"),
    });
  }
  let roles: string[] = [];
  let quick: Record<string, string> = {};
  try {
    roles = JSON.parse(String(form.get("roles") || "[]"));
    quick = JSON.parse(String(form.get("quick") || "{}"));
  } catch {
    throw new BackendError(
      400,
      "The capture details could not be read. Please try again.",
    );
  }
  if (
    !Array.isArray(roles) ||
    !quick ||
    Array.isArray(quick) ||
    typeof quick !== "object" ||
    Object.values(quick).some((v) => typeof v !== "string" || v.length > 1000)
  )
    throw new BackendError(
      400,
      "Please shorten the capture details and try again.",
    );
  const context = String(form.get("context") || "");
  if (context.length > 20000)
    throw new BackendError(
      400,
      "Keep the recollection below 20,000 characters.",
    );
  const kind = String(form.get("kind") || "Photograph");
  if (
    ![
      "Photograph",
      "Letter",
      "Document",
      "Object",
      "Postcard",
      "Certificate",
      "Artwork",
      "Other",
    ].includes(kind)
  )
    throw new BackendError(400, "Choose a supported item type.");
  const manifest = prepared.map((f, i) => ({
    name: f.source.name.slice(0, 255),
    size: f.source.size,
    mimeType: f.mimeType,
    sha256: f.sha256,
    role: String(roles[i] || "image").slice(0, 40),
  }));
  const { data: id, error } = await client.rpc("begin_ingestion", {
    p_archive_id: archiveId,
    p_capture_id: captureId,
    p_title: String(form.get("title") || "New archive item").slice(0, 300),
    p_kind: kind,
    p_context: context,
    p_quick: quick,
    p_files: manifest,
  });
  if (error || typeof id !== "string")
    throw new BackendError(
      error?.code === "42501" ? 403 : 503,
      "The capture could not be prepared. Check your membership and database setup, then retry.",
    );
  const { data: files, error: fileError } = await client
    .from("archive_item_files")
    .select("*")
    .eq("archive_id", archiveId)
    .eq("item_id", id)
    .order("page_order");
  if (fileError || !files || files.length !== prepared.length)
    throw new BackendError(
      503,
      "The file reservations could not be loaded. Retry with the same original files.",
    );
  // This server request hashes untouched submitted bytes. SQL separately verifies Storage receipts.
  for (let index = 0; index < prepared.length; index++) {
    const expected = prepared[index],
      reserved = files[index];
    if (
      reserved.sha256 !== expected.sha256 ||
      Number(reserved.byte_size) !== expected.source.size ||
      reserved.mime_type !== expected.mimeType
    )
      throw new BackendError(
        409,
        "This retry has different files. Return to capture and start a new item; existing originals will not be overwritten.",
      );
    const { error: uploadError } = await client.storage
      .from(reserved.bucket_id)
      .upload(reserved.storage_path, expected.bytes, {
        contentType: expected.mimeType,
        upsert: false,
        cacheControl: "0",
      });
    if (uploadError) {
      const { data: existing, error: readError } = await client.storage
        .from(reserved.bucket_id)
        .download(reserved.storage_path);
      if (
        readError ||
        !existing ||
        createHash("sha256")
          .update(Buffer.from(await existing.arrayBuffer()))
          .digest("hex") !== expected.sha256
      )
        throw new BackendError(
          503,
          "An original could not finish uploading. Keep this page open and retry; preserved originals will not be replaced.",
        );
    }
  }
  const { error: finishError } = await client.rpc("complete_ingestion", {
    p_archive_id: archiveId,
    p_item_id: id,
  });
  if (finishError)
    throw new BackendError(
      503,
      "Some originals may already be preserved, but receipt confirmation is incomplete. Retry this capture with the same files.",
    );
  return { id };
}
