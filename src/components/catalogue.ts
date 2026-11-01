"use client";
import { useWorkspace } from "./workspace-provider";
import { items, people, places } from "@/lib/data";
export function useCatalogue() {
  const workspace = useWorkspace();
  return workspace.mode === "demo"
    ? {
        items: [
          ...workspace.captures.map<import("@/lib/types").ArchiveItem>((c) => ({
            archiveId: c.archiveId,
            id: c.id,
            slug: c.id,
            href: `/add/saved/${c.id}`,
            title: c.title,
            kind: c.kind as import("@/lib/types").ItemKind,
            date: c.quick.When || "Date not yet known",
            place: c.quick.Where || "Place not yet known",
            people: [],
            collection: "Uncatalogued",
            image: c.files[0]?.url || "/images/empty-archive.svg",
            alt: c.title,
            aspect: "landscape" as const,
            certainty: "family_reported" as const,
            notes: c.recollection.originalText,
            tags: [],
            importBatchId: c.importBatchId,
          })),
          ...items,
        ],
        people,
        places,
      }
    : {
        items: workspace.catalogue,
        people: workspace.historicalPeople,
        places: (workspace.historicalPlaces || []).map((p) => ({
          slug: p.id,
          name: p.name,
          region: p.region,
          image: "",
          description: p.notes,
        })),
      };
}
