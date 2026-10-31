import type { CaptureKind, Suggestion } from "./workspace-types";
export function previewSuggestions(
  text: string,
  kind: CaptureKind,
): Suggestion[] {
  const values: {
    field: Suggestion["field"];
    value: string;
    uncertain?: boolean;
  }[] = [];
  if (/janice/i.test(text))
    values.push({ field: "People", value: "Janice Allen" });
  if (/margaret/i.test(text))
    values.push({
      field: "People",
      value: "Aunt Margaret · identity unresolved",
      uncertain: true,
    });
  const year = text.match(/\b(18|19|20)\d{2}\b/);
  if (year)
    values.push({
      field: "When",
      value: `Around ${year[0]}`,
      uncertain: /probably|around|think|perhaps/i.test(text),
    });
  const place = text.match(/Shropshire|Sydney|Bondi|Blue Mountains/i);
  if (place)
    values.push({
      field: "Where",
      value: place[0] === "Shropshire" ? "Shropshire, England" : place[0],
    });
  values.push({ field: "Type", value: kind });
  return values.map((v) => ({
    id: crypto.randomUUID(),
    field: v.field,
    value: v.value,
    originalValue: v.value,
    status: v.uncertain ? "uncertain" : "suggested",
    origin: "demo_interpretation",
  }));
}
