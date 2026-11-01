import type { Person } from "./types";

export interface Identification {
  id: string;
  archive_id: string;
  item_id: string;
  person_id: string | null;
  proposed_name: string;
  proposed_by: string;
  created_at: string;
  status: "reported" | "accepted" | "rejected";
  role_context?: string;
  source?: "legacy_report" | "human_report";
  linked_by?: string | null;
  linked_at?: string | null;
  reviewed_by?: string | null;
}

export function linkedPersonIds(
  identifications: Identification[],
  itemId: string,
) {
  return [
    ...new Set(
      identifications
        .filter(
          (i) => i.item_id === itemId && i.person_id && i.status !== "rejected",
        )
        .map((i) => i.person_id!),
    ),
  ];
}

export function matchingPeople(people: Person[], query: string) {
  const words = query.trim().toLocaleLowerCase().split(/\s+/).filter(Boolean);
  return people.filter((person) =>
    words.every((word) => person.name.toLocaleLowerCase().includes(word)),
  );
}
