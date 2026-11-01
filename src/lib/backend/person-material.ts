import "server-only";
import { requireSession } from "./repository";
import { allRows } from "./catalogue";
export interface PersonRecollection {
  id: string;
  item_id: string;
  original_text: string;
  recorded_at: string;
}
export async function personRecollections(
  archiveId: string,
  itemIds: string[],
) {
  const { client } = await requireSession();
  const batches = Array.from(
    { length: Math.ceil(itemIds.length / 100) },
    (_, n) => itemIds.slice(n * 100, n * 100 + 100),
  );
  const values = await Promise.all(
    batches.map((ids) =>
      allRows<PersonRecollection>(
        (from, to) =>
          client
            .from("recollections")
            .select("id,item_id,original_text,recorded_at", { count: "exact" })
            .eq("archive_id", archiveId)
            .in("item_id", ids)
            .order("id")
            .range(from, to)
            .retry(false)
            .abortSignal(AbortSignal.timeout(3000)),
        (r) => r.id,
      ),
    ),
  );
  return values.flatMap((v) => v.data).filter((r) => r.original_text?.trim());
}
