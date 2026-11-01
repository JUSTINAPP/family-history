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
  from?: string[];
  to?: string[];
  hasTranscription?: boolean;
  hasReviewedTranscription?: boolean;
}
export function cataloguePresentation(context: CatalogueContext): {
  title: string;
  titleSource: "explicit" | "derived";
  catalogueState: "Catalogued" | "In progress" | "Not yet catalogued";
} {
  const kind = context.kind === "Other" ? "Archive item" : context.kind;
  const raw = context.title?.trim() || "";
  const explicit = raw && ! /^(photograph|letter|document|object|postcard|certificate|artwork|other|archive item), still to be catalogued$/i.test(raw);
  const people = context.people?.filter(Boolean) || [];
  const rawDate = context.date?.trim();
  const date = rawDate && context.datePrecision === "approximate" && !/^c\.?\s|^circa /i.test(rawDate)
    ? `c. ${rawDate}` : rawDate;
  const place = context.place?.trim();
  const meaningful = !!(explicit || people.length || date || place || context.notes?.trim() || context.hasRecollection || context.hasTranscription);
  const from=context.from?.filter(Boolean).join(" & "), to=context.to?.filter(Boolean).join(" & ");
  const correspondence=context.kind==="Letter" && !!(from||to);
  const year=rawDate?.match(/^[0-9]{4}/)?.[0];
  const catalogued=context.catalogued || (context.kind==="Letter" && (context.hasReviewedTranscription || (correspondence && !!date)));
  let title: string;
  if (explicit) title = raw;
  else if (correspondence) title=`Letter${from?` from ${from}`:""}${to?` to ${to}`:""}${year?`, ${year}`:""}`;
  else if (context.kind==="Letter" && context.hasTranscription) title="Letter";
  else if (people.length) title = `${people.slice(0, 2).join(" & ")}${people.length > 2 ? " and others" : ""}${date ? `, ${date}` : ""}`;
  else if (place) title = `${kind} from ${place}${date ? `, ${date}` : ""}`;
  else if (date) title = `${kind}, ${date}`;
  else if (meaningful) title = `${kind} with ${context.hasRecollection ? "a recollection" : "notes"}`;
  else title = catalogued ? kind : `${kind}, still to be catalogued`;
  return {
    title,
    titleSource: explicit ? "explicit" : "derived",
    catalogueState: catalogued ? "Catalogued" : meaningful || correspondence ? "In progress" : "Not yet catalogued",
  };
}
