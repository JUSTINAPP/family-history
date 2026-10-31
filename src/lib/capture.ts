import type { CaptureDraft, ItemKind } from "./types";
export const ACCEPTED_IMAGE_TYPES = [
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/heic",
  "image/heif",
];
export const MAX_FILE_BYTES = 30 * 1024 * 1024;
export function validateFiles(files: File[]): {
  accepted: File[];
  error: string;
} {
  const accepted = files.filter(
    (f) =>
      ACCEPTED_IMAGE_TYPES.includes(f.type) ||
      (!f.type && /\.(jpe?g|png|webp|heic|heif)$/i.test(f.name)),
  );
  const sized = accepted.filter((f) => f.size <= MAX_FILE_BYTES);
  return {
    accepted: sized,
    error:
      sized.length !== files.length
        ? "Some files were skipped. Choose JPEG, PNG, WebP or HEIC images up to 30 MB each. HEIC previews are prepared separately; the original file is retained."
        : "",
  };
}
export function createDraft(
  data: FormData,
  kind: ItemKind,
  files: File[],
  archiveId: string,
): CaptureDraft {
  const read = (key: string) => String(data.get(key) || "").trim();
  return {
    id: crypto.randomUUID(),
    archiveId,
    kind,
    who: read("who"),
    when: read("when"),
    datePrecision: read("precision") as CaptureDraft["datePrecision"],
    where: read("where"),
    notes: read("notes"),
    author: read("author"),
    recipient: read("recipient"),
    fileNames: files.map((f) => f.name),
    createdAt: new Date().toISOString(),
  };
}
export function downloadDraft(draft: unknown) {
  const blob = new Blob([JSON.stringify(draft, null, 2)], {
    type: "application/json",
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "archive-draft.json";
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
