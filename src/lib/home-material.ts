import type { ArchiveItem } from "./types";
import { homeVisitHash } from "./home-visit";
/** Three photographs then one letter, stable for a visit. Pending previews with
 * preserved sources remain eligible so they can recover when displayed. */
export function homeMaterial(items: ArchiveItem[], limit = 12, visit?: string): ArchiveItem[] {
  const candidates = items.filter(i => !i.archivedAt && i.kind !== "Audio" &&
    (i.imageSet || i.image?.startsWith("/api/v1/previews/")))
    .sort((a, b) => (visit ? homeVisitHash(`${visit}:${a.id}`) - homeVisitHash(`${visit}:${b.id}`) : 0)
      || (b.createdAt || "").localeCompare(a.createdAt || "") || a.id.localeCompare(b.id));
  const photos = candidates.filter(i => i.kind === "Photograph");
  const letters = candidates.filter(i => i.kind === "Letter");
  const other = candidates.filter(i => i.kind !== "Photograph" && i.kind !== "Letter");
  const selected: ArchiveItem[] = [];
  while (selected.length < limit && (photos.length || letters.length || other.length)) {
    const preferred = selected.length % 4 === 3 ? letters : photos;
    const pool = preferred.length ? preferred : photos.length ? photos : letters.length ? letters : other;
    selected.push(pool.shift()!);
  }
  return selected;
}
