import "server-only";
import { requireSession } from "./repository";
import { BackendError } from "./errors";
export interface ManagementSnapshot {
  item: {
    id: string;
    archive_id: string;
    title: string;
    kind: string;
    archived_at: string | null;
    lifecycle: string;
    grouping_kind: string;
  };
  files: {
    id: string;
    name: string;
    bucket: string;
    path: string;
    purpose: string;
    size: number;
    width: number | null;
    height: number | null;
    mime: string;
    sha256: string;
  }[];
  counts: Record<string, number>;
  version: string;
  children: { id: string; title: string }[];
  deletion: { id: string; status: string; remaining?: unknown[] } | null;
}
export async function managementSnapshot(id: string) {
  const { client } = await requireSession();
  const { data, error } = await client
    .rpc("item_management_snapshot", { p_item_id: id })
    .retry(false);
  if (error || !data)
    throw new BackendError(
      error?.code === "42501" ? 403 : 503,
      "Item management is unavailable. Editor access and migration 009 are required.",
    );
  return data as ManagementSnapshot;
}
