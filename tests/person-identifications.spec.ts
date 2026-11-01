import { test, expect } from "@playwright/test";
import {
  linkedPersonIds,
  matchingPeople,
  type Identification,
} from "../src/lib/identifications";
import type { Person } from "../src/lib/types";
const report = {
  id: "report",
  archive_id: "a",
  item_id: "photo",
  person_id: null,
  proposed_name: "Jina Allen",
  proposed_by: "contributor",
  created_at: "2026-01-01",
  status: "reported",
} satisfies Identification;
test("only active relational Person IDs drive catalogue associations; text, rejected reports and other items never match", () => {
  const links: Identification[] = [
    report,
    { ...report, id: "linked", person_id: "jina" },
    { ...report, id: "confirmed", person_id: "jina", status: "accepted" },
    { ...report, id: "jan", person_id: "jan" },
    { ...report, id: "removed", person_id: "removed", status: "rejected" },
    { ...report, id: "other", item_id: "other-photo", person_id: "other" },
  ];
  expect(linkedPersonIds(links, "photo")).toEqual(["jina", "jan"]);
  expect(linkedPersonIds([report], "photo")).toEqual([]);
  expect(report.proposed_name).toBe("Jina Allen");
});
test("Person picker finds partial case-insensitive names without inventing or linking an identity", () => {
  const people = [
    { id: "jina", name: "Jina Allen" },
    { id: "jan", name: "Jan Allen" },
    { id: "jonas", name: "Jonas Allen" },
  ] as Person[];
  expect(matchingPeople(people, "Ji").map((p) => p.id)).toEqual(["jina"]);
  expect(matchingPeople(people, " ALLEN  ja ").map((p) => p.id)).toEqual([
    "jan",
  ]);
  expect(matchingPeople(people, "unknown")).toEqual([]);
  expect(people).toHaveLength(3);
});
