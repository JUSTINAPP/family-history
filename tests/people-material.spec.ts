import { test, expect } from "@playwright/test";
import { personMaterials, type PersonLink } from "../src/lib/people-material";
import type { ArchiveItem } from "../src/lib/types";
const item = (
  id: string,
  kind: ArchiveItem["kind"] = "Photograph",
  ready = true,
) =>
  ({
    id,
    archiveId: "a",
    kind,
    title: id,
    image: `/api/v1/previews/${id}`,
    imageSet: ready
      ? {
          id,
          originalId: id,
          placeholder: "data:image/webp;base64,AAAA",
          small: {
            id: `${id}-small`,
            width: 600,
            height: 400,
            size: 20,
            mime: "image/webp",
          },
          thumbnail: {
            id: `${id}-thumbnail`,
            width: 1200,
            height: 800,
            size: 40,
            mime: "image/webp",
          },
          display: {
            id: `${id}-display`,
            width: 2400,
            height: 1600,
            size: 80,
            mime: "image/jpeg",
          },
        }
      : undefined,
  }) as ArchiveItem;
const link = (
  id: string,
  status: PersonLink["status"] = "reported",
  person_id = "person",
) => ({ id: `link-${id}`, archive_id: "a", item_id: id, person_id, status });
test("no linked material remains empty; a single real item is not duplicated into a stack", () => {
  expect(personMaterials([item("one")], [], "a")).toEqual({});
  const value = personMaterials([item("one")], [link("one")], "a").person;
  expect(value.count).toBe(1);
  expect(value.items.map((i) => i.id)).toEqual(["one"]);
});
test("representatives prefer confirmed associations, then photographs, with stable source diversity and at most four items", () => {
  const items = [
    item("a-photo"),
    item("b-photo"),
    item("c-letter", "Letter"),
    item("d-doc", "Document"),
    item("e-object", "Object"),
  ];
  const links = items.map((i) => link(i.id, "accepted"));
  const a = personMaterials(items, links, "a").person;
  expect(a.items.map((i) => i.id)).toEqual([
    "a-photo",
    "c-letter",
    "d-doc",
    "e-object",
  ]);
  expect(a.count).toBe(5);
  expect(
    personMaterials([...items].reverse(), [...links].reverse(), "a").person,
  ).toEqual(a);
  expect(
    personMaterials(items, [link("b-photo", "accepted"), link("c-letter")], "a")
      .person.items[0].id,
  ).toBe("b-photo");
});
test("rejected, unlinked, foreign-archive and archived items cannot enter a Person stack", () => {
  const a = item("a"),
    b = { ...item("b"), archiveId: "other" },
    c = { ...item("c"), archivedAt: "2026-01-01" };
  const result = personMaterials(
    [a, b, c],
    [
      link("a", "rejected"),
      link("a", "reported", null as unknown as string),
      link("b"),
      link("c"),
      { ...link("a"), archive_id: "other" },
    ],
    "a",
  );
  expect(result).toEqual({});
});
test("missing thumbnail sets retain an honest linked count without requesting a master or starting conversion", () => {
  const result = personMaterials(
    [item("pending", "Photograph", false)],
    [link("pending")],
    "a",
  ).person;
  expect(result).toEqual({ count: 1, items: [] });
});
test("the same item can belong to different People without copying full notes into card payloads", () => {
  const source = { ...item("one"), notes: "Private long recollection" };
  const result = personMaterials(
    [source],
    [link("one"), link("one", "accepted", "other-person")],
    "a",
  );
  expect(result.person.items[0].id).toBe("one");
  expect(result["other-person"].items[0].id).toBe("one");
  expect(result.person.items[0]).not.toHaveProperty("notes");
});
