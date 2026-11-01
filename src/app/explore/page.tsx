import Link from "next/link";
import { notFound } from "next/navigation";
import { loadWorkspace } from "@/lib/backend/repository";
import { LiveWorkspaceProvider } from "@/components/live/live-workspace";
import { isDemoMode } from "@/lib/supabase/config";
import { Suspense } from "react";
import { Explore } from "@/components/explore";
import { reportRender } from "@/lib/backend/performance";
import { loadPlaceData, workspaceWithPlaces } from "@/lib/backend/places";
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
  let snapshot = isDemoMode()
    ? null
    : await loadWorkspace({
        materialOnly: true,
        archiveId: params.archive,
        batchId: params.batch,
        archived: params.state === "archived",
      });
  if (!isDemoMode() && !snapshot) notFound();
  if (snapshot) {
    try {
      snapshot = workspaceWithPlaces(
        snapshot,
        await loadPlaceData(snapshot.archive.id),
      );
    } catch {
      snapshot = {
        ...snapshot,
        placesAvailable: false,
        resourceWarnings: [
          ...snapshot.resourceWarnings,
          "Place associations could not load. Reload before filtering by Place.",
        ],
      };
    }
  }
  reportRender("explore");
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
          <div className="page-shell quick-entry"><Link prefetch={false} className="text-link" href={`/quick-catalogue?archive=${snapshot.archive.id}`}>Quick catalogue ↗</Link></div>
          <Explore key={filterKey} />
        </LiveWorkspaceProvider>
      ) : (
        <Explore key={filterKey} />
      )}
    </Suspense>
  );
}
