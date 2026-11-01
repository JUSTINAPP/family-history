/** Display-only interpretation. Never write a derived label into the historical title. */
export interface CatalogueContext {
  kind: string;
  title?: string | null;
  people?: string[];
  place?: string | null;
  date?: string | null;
  datePrecision?: string | null;
  notes?: string | null;
  hasRecollection?: boolean;
  catalogued?: boolean;
}
export function cataloguePresentation(context: CatalogueContext): {
  title: string;
  titleSource: "explicit" | "derived";
  catalogueState: "Catalogued" | "In progress" | "Not yet catalogued";
} {
  const kind = context.kind === "Other" ? "Archive item" : context.kind;
  const raw = context.title?.trim() || "";
  const explicit = raw && raw.toLocaleLowerCase() !== `${kind}, still to be catalogued`.toLocaleLowerCase();
  const people = context.people?.filter(Boolean) || [];
  const rawDate = context.date?.trim();
  const date = rawDate && context.datePrecision === "approximate" && !/^c\.?\s|^circa /i.test(rawDate)
    ? `c. ${rawDate}` : rawDate;
  const place = context.place?.trim();
  const meaningful = !!(explicit || people.length || date || place || context.notes?.trim() || context.hasRecollection);
  let title: string;
  if (explicit) title = raw;
  else if (people.length) title = `${people.slice(0, 2).join(" & ")}${people.length > 2 ? " and others" : ""}${date ? `, ${date}` : ""}`;
  else if (place) title = `${kind} from ${place}${date ? `, ${date}` : ""}`;
  else if (date) title = `${kind}, ${date}`;
  else if (meaningful) title = `${kind} with ${context.hasRecollection ? "a recollection" : "notes"}`;
  else title = context.catalogued ? kind : `${kind}, still to be catalogued`;
  return {
    title,
    titleSource: explicit ? "explicit" : "derived",
    catalogueState: context.catalogued ? "Catalogued" : meaningful ? "In progress" : "Not yet catalogued",
  };
}
