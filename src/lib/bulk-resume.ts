import type { BatchSource } from "./import-batches";
import type { ImportEntry } from "./bulk-import";
export function sourceEntries(sources: BatchSource[]): ImportEntry[] {
  return sources.map((source) => ({
    captureId: source.captureId,
    itemId: source.itemId,
    file: new File([], source.fileName),
    status: source.status,
    needsFile: source.status !== "saved",
    error:
      source.status === "saved"
        ? undefined
        : "Choose the original file again to resume.",
  }));
}
export async function resumeEntries(
  files: File[],
  sources: BatchSource[],
): Promise<ImportEntry[]> {
  const entries = sourceEntries(sources),
    matched = new Set<string>();
  for (const file of files) {
    const bytes = new Uint8Array(
      await crypto.subtle.digest("SHA-256", await file.arrayBuffer()),
    );
    const hash = Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join(
      "",
    );
    const source = sources.find(
      (s) =>
        !matched.has(s.captureId) &&
        s.fileName === file.name &&
        s.size === file.size &&
        s.sha256 === hash,
    );
    if (source) {
      matched.add(source.captureId);
      const index = entries.findIndex((e) => e.captureId === source.captureId);
      entries[index] = {
        captureId: source.captureId,
        file,
        itemId: source.itemId,
        status: source.status === "saved" ? "saved" : "pending",
      };
    } else
      entries.push({ captureId: crypto.randomUUID(), file, status: "pending" });
  }
  return entries;
}
