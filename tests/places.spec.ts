import { test, expect } from "@playwright/test";
import {
  matchingPlaces,
  placeMaterials,
  placeSubtitle,
  type ArchivePlace,
  type ItemPlace,
} from "../src/lib/places";
import type { ArchiveItem } from "../src/lib/types";
const place = {
  id: "place",
  archive_id: "a",
  name: "Auroville",
  locality: "",
  city: "",
  region: "Tamil Nadu",
  country: "India",
} as ArchivePlace;
test("Place search finds names and geographic context without inventing a canonical relationship", () => {
  expect(matchingPlaces([place], "Aur").map((p) => p.id)).toEqual(["place"]);
  expect(matchingPlaces([place], "tamil india")).toEqual([place]);
  expect(matchingPlaces([place], "Sydney")).toEqual([]);
  expect(placeSubtitle(place)).toBe("Tamil Nadu, India");
  expect(
    placeSubtitle({
      ...place,
      name: "Sydney",
      city: "Sydney",
      region: "NSW",
      country: "Australia",
    }),
  ).toBe("NSW, Australia");
});
test("Place piles require actual same-archive active links and ready small thumbnails, never a matching text name", () => {
  const item = {
    id: "photo",
    archiveId: "a",
    place: "Auroville",
    title: "A photograph",
    kind: "Photograph",
    image: "/api/v1/previews/source",
    imageSet: { id: "set", small: { id: "small", width: 600, height: 400 } },
  } as ArchiveItem;
  const link = {
    id: "l",
    archive_id: "a",
    item_id: "photo",
    place_id: "place",
    role: "primary",
    status: "reported",
  } as ItemPlace;
  expect(placeMaterials([item], [], "a")).toEqual({});
  expect(placeMaterials([item], [link], "a").place.items).toHaveLength(1);
  expect(placeMaterials([item], [{ ...link, status: "removed" }], "a")).toEqual(
    {},
  );
  expect(placeMaterials([item], [{ ...link, archive_id: "b" }], "a")).toEqual(
    {},
  );
  expect(
    placeMaterials([{ ...item, imageSet: undefined }], [link], "a").place,
  ).toEqual({ count: 1, items: [] });
});
