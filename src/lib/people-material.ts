import type { ArchiveItem } from "./types";
import type { Identification } from "./identifications";
export type StackMaterial = Pick<
  ArchiveItem,
  "id" | "kind" | "title" | "image" | "imageSet"
>;
export interface PersonMaterial {
  count: number;
  items: StackMaterial[];
}
export type PersonLink = Pick<
  Identification,
  "id" | "archive_id" | "item_id" | "person_id" | "status" | "role_context"
>;
// Batched, deterministic selection. Live material must have a completed image set.
export function personMaterials(
  items: ArchiveItem[],
  links: PersonLink[],
  archiveId: string,
): Record<string, PersonMaterial> {
  const byId = new Map(
    items
      .filter((i) => i.archiveId === archiveId && !i.archivedAt)
      .map((i) => [i.id, i]),
  );
  const byPerson = new Map<
    string,
    Map<string, { item: ArchiveItem; confirmed: boolean }>
  >();
  for (const link of links) {
    if (
      link.archive_id !== archiveId ||
      !link.person_id ||
      !["reported", "accepted"].includes(link.status)
    )
      continue;
    const item = byId.get(link.item_id);
    if (!item) continue;
    const list = byPerson.get(link.person_id) || new Map();
    const prior = list.get(item.id);
    list.set(item.id, {
      item,
      confirmed: link.status === "accepted" || !!prior?.confirmed,
    });
    byPerson.set(link.person_id, list);
  }
  const result: Record<string, PersonMaterial> = {};
  for (const [personId, values] of byPerson) {
    const remaining = [...values.values()]
      .filter((v) => v.item.imageSet)
      .sort(
        (a, b) =>
          Number(b.confirmed) - Number(a.confirmed) ||
          Number(b.item.kind === "Photograph") -
            Number(a.item.kind === "Photograph") ||
          a.item.id.localeCompare(b.item.id),
      );
    const selected: ArchiveItem[] = [];
    while (remaining.length && selected.length < 4) {
      const diverse = remaining.findIndex(
        (v) =>
          v.confirmed === remaining[0].confirmed &&
          !selected.some((i) => i.kind === v.item.kind),
      );
      const index = diverse < 0 ? 0 : diverse;
      selected.push(remaining.splice(index, 1)[0].item);
    }
    result[personId] = {
      count: values.size,
      items: selected.map(({ id, kind, title, image, imageSet }) => ({
        id,
        kind,
        title,
        image,
        imageSet,
      })),
    };
  }
  return result;
}
