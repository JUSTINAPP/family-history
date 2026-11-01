import { notFound } from "next/navigation";
import { loadWorkspace } from "@/lib/backend/repository";
import { LiveWorkspaceProvider } from "@/components/live/live-workspace";
import { isDemoMode } from "@/lib/supabase/config";
import { Suspense } from "react";
import { Explore } from "@/components/explore";
export const dynamic = "force-dynamic";
export const metadata = { title: "Explore the archive" };
export default async function ExplorePage({
  searchParams,
}: {
  searchParams: Promise<{
    batch?: string;
    state?: string;
    archive?: string;
    q?: string;
    type?: string;
    place?: string;
    person?: string;
    unidentified?: string;
  }>;
}) {
  const params = await searchParams;
  const snapshot = isDemoMode()
    ? null
    : await loadWorkspace({
        archiveId: params.archive,
        batchId: params.batch,
        archived: params.state === "archived",
      });
  if (!isDemoMode() && !snapshot) notFound();
  const filterKey = JSON.stringify(params);
  return (
    <Suspense
      fallback={
        <div className="page-shell">
          <p className="page-intro">Opening the archive…</p>
        </div>
      }
    >
      {snapshot ? (
        <LiveWorkspaceProvider
          key={`${snapshot.archive.id}:${snapshot.catalogueBatchId || "all"}`}
          snapshot={snapshot}
        >
          <Explore key={filterKey} />
        </LiveWorkspaceProvider>
      ) : (
        <Explore key={filterKey} />
      )}
    </Suspense>
  );
}
