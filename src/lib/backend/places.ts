import { cataloguePresentation } from "../catalogue-presentation";
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
  const placesById = new Map(data.places.map(p => [p.id, p]));
  const namesById = new Map(snapshot.people.map(p => [p.id, p.name]));
  const primaryByItem = new Map(data.links.filter(l => l.status !== "removed" && l.role === "primary").map(l => [l.item_id, l.place_id]));
  return {
    ...snapshot,
    places: data.places,
    placeLinks: data.links,
    placesAvailable: true,
    catalogue: snapshot.catalogue.map((item) => {
      const placeIds = [...(ids.get(item.id) || [])];
      const place = placesById.get(primaryByItem.get(item.id) || placeIds[0]);
      const display = cataloguePresentation({kind: item.kind, title: item.rawTitle, datePrecision: item.datePrecision,
        people: item.people.map(id => namesById.get(id) || "Person linked"),
        place: place?.name || (item.place === "Place not yet known" ? "" : item.place),
        date: item.date === "Date not yet known" ? "" : item.date,
        notes: item.notes || item.reportedPeople, hasRecollection: item.hasRecollection,
        catalogued: item.collection === "Catalogued"});
      return {...item, ...display, alt: display.title, placeIds, collection: display.catalogueState === "Not yet catalogued" ? "Uncatalogued" : display.catalogueState};
    }),
  };
}
