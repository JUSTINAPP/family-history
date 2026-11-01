export interface FamilyComment {
  id: string;
  archive_id: string;
  item_id: string;
  author_id: string;
  body: string;
  created_at: string;
  edited_at?: string | null;
  archived_at?: string | null;
  parent_id?: string | null;
  revision: number;
}
export const datePrecisions = ["exact", "month", "year", "approximate", "decade", "unknown"] as const;
export type HistoricalDatePrecision = typeof datePrecisions[number];
export function historicalDate(value: string, precision?: string) {
  if (!value) return "Not yet known";
  return precision === "approximate" && !/^c\.?\s|^circa /i.test(value) ? `c. ${value}` : value;
}
export function needsInformation(item: {people: string[]; placeIds?: string[]; date: string}) {
  return !item.people.length || !item.placeIds?.length || !item.date || item.date === "Date not yet known";
}
/** Missing/moderated roots get a neutral thread label; replies never become another person's words. */
export function commentThreads(comments: FamilyComment[]) {
  const roots = new Map<string, {root?: FamilyComment; replies: FamilyComment[]}>();
  for (const comment of comments) {
    const id = comment.parent_id || comment.id;
    const thread = roots.get(id) || {replies: []};
    if (comment.parent_id) thread.replies.push(comment); else thread.root = comment;
    roots.set(id, thread);
  }
  return [...roots.entries()].sort((a, b) => {
    const time = (t: typeof a[1]) => t.root?.created_at || t.replies[0]?.created_at || "";
    return time(a[1]).localeCompare(time(b[1])) || a[0].localeCompare(b[0]);
  });
}
