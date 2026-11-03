import { expect, test } from "@playwright/test";
import { cataloguePresentation } from "../src/lib/catalogue-presentation";
import { homeMaterial } from "../src/lib/home-material";
import type { ArchiveItem } from "../src/lib/types";
const untouched = {kind: "Photograph", title: "Photograph, still to be catalogued"};
test("display labels progress with context without rewriting historical titles", () => {
  expect(cataloguePresentation(untouched)).toMatchObject({title: untouched.title, catalogueState: "Not yet catalogued", titleSource: "derived"});
  expect(cataloguePresentation({...untouched, people: ["Jina Allen"], date: "1985", datePrecision: "approximate"})).toMatchObject({title: "Jina Allen, c. 1985", catalogueState: "In progress"});
  expect(cataloguePresentation({...untouched, place: "Auroville"}).title).toBe("Photograph from Auroville");
  expect(cataloguePresentation({...untouched, hasRecollection: true})).toMatchObject({title: "Photograph with a recollection", catalogueState: "In progress"});
  expect(cataloguePresentation({...untouched, catalogued: true}).title).toBe("Photograph");
  expect(untouched.title).toBe("Photograph, still to be catalogued");
});
test("explicit titles win and completeness does not demand all metadata", () => {
  expect(cataloguePresentation({...untouched, title: "A day together", people: ["Jina Allen"], place: "Sydney", catalogued: true})).toEqual({title: "A day together", titleSource: "explicit", catalogueState: "Catalogued"});
  for (const context of [{people: ["Jan"]}, {place: "Jan’s house"}, {date: "1985"}, {notes: "A family gathering"}, {title: "At home"}])
    expect(cataloguePresentation({...untouched, ...context}).catalogueState).toBe("In progress");
});
function item(id: string, options: Partial<ArchiveItem> = {}) {
  return {id, kind: "Photograph", people: [], placeIds: [], imageSet: {small: {id: "small"}}, createdAt: "2026-11-01", updatedAt: "2026-11-01", ...options} as ArchiveItem;
}
test("home selection is stable, varied and limited to actual ready material", () => {
  const rows = [item("a"),item("b"),item("c", {kind: "Letter"}),item("d", {people: ["person"]}),item("e", {placeIds: ["place"]}),item("f", {archivedAt: "2026"}),item("g", {imageSet: undefined})];
  expect(homeMaterial(rows, 4).map(i => i.id)).toEqual(["a", "b", "d", "c"]);
  expect(homeMaterial([...rows].reverse(), 4)).toEqual(homeMaterial(rows, 4));
  expect(homeMaterial(rows, 9)).toHaveLength(5);
  expect(homeMaterial([], 9)).toEqual([]);
});

test("visit seeds vary the feature without changing eligible data or reshuffling a visit", () => {
  const rows = Array.from({length: 24}, (_, i) => item(String(i), {kind: i % 3 === 0 ? "Letter" : i % 3 === 1 ? "Object" : "Photograph"}));
  rows.push(item("archived", {archivedAt: "2026"}), item("pending", {imageSet: undefined}), item("audio", {kind: "Audio"}));
  const selections = new Set<string>();
  for (let visit = 0; visit < 12; visit++) {
    const chosen = homeMaterial(rows, 3, `visit-${visit}`);
    expect(chosen).toEqual(homeMaterial([...rows].reverse(), 3, `visit-${visit}`));
    expect(chosen).toHaveLength(3);
    expect(chosen.every(i => i.kind === "Photograph")).toBe(true);
    expect(chosen.every(i => !["archived", "pending", "audio"].includes(i.id))).toBe(true);
    selections.add(chosen.map(i => i.id).join(","));
  }
  expect(selections.size).toBeGreaterThan(1);
  expect(homeMaterial([], 3, "visit")).toEqual([]);
  expect(homeMaterial([rows[0]], 3, "visit")).toEqual([rows[0]]);
  expect(homeMaterial(rows.slice(0, 2), 3, "visit")).toHaveLength(2);
});

test("classification updates derived placeholder labels while retaining deliberate titles",()=>{
  expect(cataloguePresentation({kind:"Letter",title:"Photograph, still to be catalogued"}).title).toBe("Letter, still to be catalogued");
  expect(cataloguePresentation({kind:"Document",title:"A letter from Jan"}).title).toBe("A letter from Jan");
});

test("a letter dump cannot crowd photos out of Home and missing previews can recover", () => {
  const photos = Array.from({length: 9}, (_, i) => item(`photo-${i}`));
  const letters = Array.from({length: 100}, (_, i) => item(`letter-${i}`, {kind: "Letter", createdAt: "2026-12-01", imageSet: undefined, image: `/api/v1/previews/letter-${i}`}));
  for (const visit of [undefined, "session-a", "session-b"]) {
    const mix = homeMaterial([...letters, ...photos], 12, visit);
    expect(mix.map(i => i.kind)).toEqual(Array.from({length: 12}, (_, i) => i % 4 === 3 ? "Letter" : "Photograph"));
    expect(new Set(mix.map(i => i.id)).size).toBe(12);
  }
  expect(homeMaterial(letters, 4)).toHaveLength(4);
  expect(homeMaterial(photos, 12)).toHaveLength(9);
});
