import type { ImageSet } from "./types";
// Serialise decoder requests in this tab and deduplicate cards for the same source.
let queue: Promise<unknown> = Promise.resolve();
const pending = new Map<string, Promise<ImageSet | undefined>>();
export function prepareDisplay(
  url: string,
  retry = false,
): Promise<ImageSet | undefined> {
  url = url.split("?")[0];
  if (retry) pending.delete(url);
  const existing = pending.get(url);
  if (existing) return existing;
  const task = queue
    .catch(() => {})
    .then(async () => {
      let response: Response;
      try {
        response = await fetch(url, { method: "POST" });
      } catch {
        throw new Error(
          "Preview interrupted. Original preserved; retry when connected.",
        );
      }
      const result = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(result.error || "Preview pending. Original preserved.");
      }
      return result.imageSet as ImageSet | undefined;
    });
  queue = task;
  pending.set(url, task);
  return task;
}
