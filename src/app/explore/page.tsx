import { completedTranscriptions, reviewedDocumentSearch } from "@/lib/documents/repository";
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
  if (snapshot) {
    try {
      const text=await reviewedDocumentSearch(snapshot.archive.id);
      snapshot={...snapshot,catalogue:snapshot.catalogue.map(item=>({...item,reviewedText:(text.get(item.id)||[]).join("\n")}))};
    } catch {snapshot={...snapshot,resourceWarnings:[...snapshot.resourceWarnings,"Reviewed document text could not load. Title and metadata search remain available."]};}
  }
  reportRender("explore");
  if (snapshot) {
    try {
      const runs = await completedTranscriptions(snapshot.archive.id);
      snapshot = {...snapshot, catalogue: snapshot.catalogue.map(item => ({...item, transcriptionRunId: runs.get(item.id)}))};
    } catch {
      snapshot = {...snapshot, resourceWarnings: [...snapshot.resourceWarnings, "Transcription status could not load. Open a letter to check its transcription."]};
    }
  }
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
