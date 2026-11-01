import "server-only";
import { cache } from "react";
import { requireSession, type LiveSnapshot } from "./repository";
import { allRows } from "./catalogue";
import type { ArchivePlace, ItemPlace } from "../places";
export const loadPlaceData = cache(
  async (archiveId: string, itemId?: string) => {
    const { client } = await requireSession();
    const [places, links] = await Promise.all([
      allRows<ArchivePlace>(
        (from, to) =>
          client
            .from("places")
            .select("*", { count: "exact" })
            .eq("archive_id", archiveId)
            .order("name")
            .order("id")
            .range(from, to)
            .retry(false)
            .abortSignal(AbortSignal.timeout(3000)),
        (p) => p.id,
      ),
      allRows<ItemPlace>(
        (from, to) => {
          let q = client
            .from("item_places")
            .select("*", { count: "exact" })
            .eq("archive_id", archiveId)
            .order("id");
          if (itemId) q = q.eq("item_id", itemId);
          else q = q.in("status", ["reported", "confirmed"]);
          return q
            .range(from, to)
            .retry(false)
            .abortSignal(AbortSignal.timeout(3000));
        },
        (l) => l.id,
      ),
    ]);
    return { places: places.data, links: links.data };
  },
);
export function workspaceWithPlaces(
  snapshot: LiveSnapshot,
  data: Awaited<ReturnType<typeof loadPlaceData>>,
): LiveSnapshot {
  const ids = new Map<string, Set<string>>();
  for (const link of data.links)
    if (link.status !== "removed" && link.archive_id === snapshot.archive.id) {
      const group = ids.get(link.item_id) || new Set<string>();
      group.add(link.place_id);
      ids.set(link.item_id, group);
    }
  return {
    ...snapshot,
    places: data.places,
    placeLinks: data.links,
    placesAvailable: true,
    catalogue: snapshot.catalogue.map((item) => ({
      ...item,
      placeIds: [...(ids.get(item.id) || [])],
    })),
  };
}
