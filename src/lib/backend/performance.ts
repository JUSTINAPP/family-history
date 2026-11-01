import "server-only";
import { cache } from "react";
const metrics = cache(() => ({
  started: performance.now(),
  databaseQueries: 0,
  authQueries: 0,
  queryMs: 0,
}));
const enabled = () =>
  process.env.NODE_ENV === "development" &&
  process.env.ARCHIVE_PERF_DIAGNOSTICS === "1";
const queryNames = new Set([
  "archives",
  "archive_memberships",
  "archive_items",
  "archive_item_files",
  "people",
  "import_batch_items",
  "current_image_sets",
  "identifications",
  "recollections",
  "processing_jobs",
  "activity_log",
]);
export const measuredFetch: typeof fetch = async (input, init) => {
  const started = performance.now();
  const state = enabled() ? metrics() : null;
  try {
    return await fetch(input, { ...init, cache: "no-store" });
  } finally {
    if (enabled()) {
      const path = new URL(input instanceof Request ? input.url : String(input))
        .pathname;
      const m = state!;
      const durationMs = Math.round(performance.now() - started);
      if (path.startsWith("/rest/v1/")) m.databaseQueries++;
      if (path.startsWith("/auth/")) m.authQueries++;
      m.queryMs += durationMs;
      console.info(
        JSON.stringify({
          event: "archive_query",
          operation: queryNames.has(path.split("/").pop() || "")
            ? path.split("/").pop()
            : path.startsWith("/auth/")
              ? "authentication"
              : "storage_or_rpc",
          category: path.startsWith("/rest/")
            ? "database"
            : path.startsWith("/auth/")
              ? "auth"
              : "storage",
          durationMs,
          databaseQueries: m.databaseQueries,
          authQueries: m.authQueries,
        }),
      );
    }
  }
};
export function reportRender(page: "home" | "explore" | "people" | "person") {
  if (!enabled()) return;
  const m = metrics();
  console.info(
    JSON.stringify({
      event: "archive_render",
      page,
      databaseQueries: m.databaseQueries,
      authQueries: m.authQueries,
      aggregateQueryMs: m.queryMs,
      approximateRenderMs: Math.round(performance.now() - m.started),
    }),
  );
}
