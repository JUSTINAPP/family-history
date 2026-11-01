import Link from "next/link";
import { isDemoMode } from "@/lib/supabase/config";
import { notFound } from "next/navigation";
import { requireArchiveRole, loadWorkspace } from "@/lib/backend/repository";
import { PageIntro } from "@/components/ui";
import { LiveWorkspaceProvider } from "@/components/live/live-workspace";
import { AdminShell } from "@/components/admin/admin-shell";
export default async function DeletionsPage({
  searchParams,
}: {
  searchParams: Promise<{ archive?: string }>;
}) {
  if (isDemoMode()) notFound();
  const snapshot = await loadWorkspace({
    archiveId: (await searchParams).archive,
    catalogue: false,
  });
  if (!snapshot) notFound();
  const { client } = await requireArchiveRole(
    snapshot.archive.id,
    "editor",
  ).catch(() => notFound());
  const { data, error } = await client
    .from("item_deletions")
    .select("item_id,status,created_at")
    .eq("archive_id", snapshot.archive.id)
    .eq("status", "pending")
    .order("created_at");
  return (
    <LiveWorkspaceProvider snapshot={snapshot}>
      <AdminShell>
        <div className="page-shell">
          <PageIntro
            eyebrow="ADMINISTRATION"
            title="Deletion progress"
            description="Editors and Admins can resume confirmed permanent deletions in this archive."
          />
          {error ? (
            <p>
              Deletion progress could not load. Check migration 009 and retry.
            </p>
          ) : data?.length ? (
            <ul>
              {data.map((d) => (
                <li key={d.item_id}>
                  <Link href={`/archive/${d.item_id}/manage`}>
                    Resume deletion · {d.item_id} ↗
                  </Link>
                </li>
              ))}
            </ul>
          ) : (
            <p>No deletions are pending.</p>
          )}
        </div>
      </AdminShell>
    </LiveWorkspaceProvider>
  );
}
