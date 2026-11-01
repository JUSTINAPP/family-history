import type { ArchiveItem } from "./types";
/** Stable editorial mix: newest ready anchor, then new kinds, People and Places.
 * Ties use update time, creation time and ID; no inferred image similarity.
 */
export function homeMaterial(items: ArchiveItem[], limit = 9): ArchiveItem[] {
  const candidates = items
    .filter(i => !i.archivedAt && i.imageSet && i.kind !== "Audio")
    .sort((a, b) => (b.updatedAt || "").localeCompare(a.updatedAt || "")
      || (b.createdAt || "").localeCompare(a.createdAt || "") || a.id.localeCompare(b.id));
  const selected: ArchiveItem[] = [];
  const kinds = new Set<string>(), people = new Set<string>();
  const places = new Set<string>(), batches = new Set<string>();
  while (candidates.length && selected.length < limit) {
    let best = 0, score = -Infinity;
    candidates.forEach((item, index) => {
      const value = (kinds.has(item.kind) ? 0 : 4)
        + (item.people.some(id => !people.has(id)) ? 3 : 0)
        + (item.placeIds?.some(id => !places.has(id)) ? 3 : 0)
        - (item.importBatchId && batches.has(item.importBatchId) ? 2 : 0)
        - index / (candidates.length + 1);
      if (value > score) { score = value; best = index; }
    });
    const [item] = candidates.splice(selected.length ? best : 0, 1);
    selected.push(item);
    kinds.add(item.kind);
    item.people.forEach(id => people.add(id));
    item.placeIds?.forEach(id => places.add(id));
    if (item.importBatchId) batches.add(item.importBatchId);
  }
  return selected;
}
