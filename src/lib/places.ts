import type { ArchiveItem } from "./types";
import { personMaterials } from "./people-material";
export interface ArchivePlace {
  id: string;
  archive_id: string;
  name: string;
  locality: string;
  city: string;
  region: string;
  country: string;
  latitude: number | null;
  longitude: number | null;
  notes: string;
  created_by: string;
  created_at: string;
  updated_at: string;
}
export interface ItemPlace {
  reviewed_by?: string | null;
  reviewed_at?: string | null;
  id: string;
  archive_id: string;
  item_id: string;
  place_id: string;
  role: "primary" | "written_in" | "sent_to" | "depicted" | "related";
  status: "reported" | "confirmed" | "removed";
  source: "human_report" | "legacy_text";
  reported_text: string;
  created_by: string;
  created_at: string;
}
export function placeSubtitle(
  place: Pick<
    ArchivePlace,
    "name" | "locality" | "city" | "region" | "country"
  >,
) {
  return [
    ...new Set(
      [place.locality, place.city, place.region, place.country].filter(
        (v) => v?.trim() && v.trim() !== place.name.trim(),
      ),
    ),
  ].join(", ");
}
export function matchingPlaces(places: ArchivePlace[], query: string) {
  const words = query.trim().toLocaleLowerCase().split(/\s+/).filter(Boolean);
  return places.filter((p) =>
    words.every((w) =>
      `${p.name} ${placeSubtitle(p)}`.toLocaleLowerCase().includes(w),
    ),
  );
}
export function placeMaterials(
  items: ArchiveItem[],
  links: ItemPlace[],
  archiveId: string,
) {
  const material = personMaterials(
    items,
    links
      .filter((l) => l.status !== "removed")
      .map((l) => ({
        ...l,
        person_id: l.place_id,
        status:
          l.status === "confirmed"
            ? ("accepted" as const)
            : ("reported" as const),
      })),
    archiveId,
  );
  return material;
}
