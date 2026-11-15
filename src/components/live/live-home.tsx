import { ArchiveLoading } from "../archive-loading";
import { HomeGallery } from "../home-gallery";
import Link from "next/link";
import { loadWorkspace, requireSession } from "@/lib/backend/repository";
import { completedTranscriptions } from "@/lib/documents/repository";
import { loadRecordings } from "@/lib/audio/repository";
import { LiveWorkspaceProvider } from "./live-workspace";
import { loadPlaceData, workspaceWithPlaces } from "@/lib/backend/places";
import { homeMaterial } from "@/lib/home-material";
import { reportRender } from "@/lib/backend/performance";
import { cookies } from "next/headers";
import { HOME_VISIT_COOKIE, homeVisitHash } from "@/lib/home-visit";
export async function LiveHome() {
  let workspace = await loadWorkspace({ materialOnly: true });
  if (!workspace) return null;
  const { client } = await requireSession();
  const [audio, places, transcriptions] = await Promise.all([
    loadRecordings(client, workspace.archive.id).then(recordings => ({recordings, unavailable: false})).catch(() => ({recordings: [], unavailable: true})),
    loadPlaceData(workspace.archive.id).catch(() => null),
    completedTranscriptions(workspace.archive.id).catch(() => new Map<string, string>()),
  ]);
  if (places) workspace = workspaceWithPlaces(workspace, places);
  workspace = {...workspace, catalogue: workspace.catalogue.map(item => ({...item, transcriptionRunId: transcriptions.get(item.id)}))};
  const visit = `${workspace.archive.id}:${(await cookies()).get(HOME_VISIT_COOKIE)?.value || "initial"}`;
  const gallery = homeMaterial(workspace.catalogue, workspace.catalogue.length, visit);
  reportRender("home");
  return (
    <div className="page-shell scrapbook-home" data-arrangement={homeVisitHash(visit) % 3}>
      <div className="sr-only">
        <h1>From the collection</h1>
      </div>
      {!workspace.catalogueAvailable ? (
        <p className="notice">The item list could not load. Saved items have not been removed. <Link href={`/explore?archive=${workspace.archive.id}`}>Retry View everything ↗</Link></p>
      ) : !workspace.catalogue.length ? (
        <section className="empty-state"><h2>No items yet</h2><p>Add photographs, letters, documents or objects to this archive.</p><Link className="button" href="/add">Add to archive</Link></section>
      ) : <>
        {audio.unavailable && <p className="notice">Voice memories could not load. Refresh to try again.</p>}
        {!!gallery.length && <LiveWorkspaceProvider snapshot={workspace}><HomeGallery archiveId={workspace.archive.id} items={gallery} recordings={audio.recordings} /></LiveWorkspaceProvider>}
        {!gallery.length && <ArchiveLoading recover names={workspace.people.filter(person=>workspace.catalogue.some(item=>item.people.includes(person.id))).map(person=>person.name).slice(0,8)}/>}


      </>}
    </div>
  );
}
