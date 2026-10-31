"use client";
import { useWorkspace } from "./workspace-provider";
import { items, people, places } from "@/lib/data";
export function useCatalogue() {
  const workspace = useWorkspace();
  return workspace.mode === "demo"
    ? { items, people, places }
    : {
        items: workspace.catalogue,
        people: workspace.historicalPeople,
        places: [...new Set(workspace.catalogue.map((i) => i.place))]
          .filter((p) => p !== "Place not yet known")
          .map((name) => ({
            slug: name,
            name,
            region: "",
            image: "",
            description: "",
          })),
      };
}
