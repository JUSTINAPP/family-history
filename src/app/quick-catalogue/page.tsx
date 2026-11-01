import { notFound } from "next/navigation";
import Link from "next/link";
import { isDemoMode } from "@/lib/supabase/config";
import { loadWorkspace, type LiveSnapshot } from "@/lib/backend/repository";
import { loadPlaceData, workspaceWithPlaces } from "@/lib/backend/places";
import { quickContext } from "@/lib/backend/quick-catalogue";
import { QuickCatalogue } from "@/components/live/quick-catalogue";
import { needsInformation } from "@/lib/conversation";
export const dynamic = "force-dynamic";
export const metadata = {title: "Quick catalogue"};
type Params = {archive?: string; page?: string; needs?: string};
async function loadQuickData(initial: LiveSnapshot, params: Params) {
  const places = await loadPlaceData(initial.archive.id);
  const snapshot = workspaceWithPlaces(initial, places);
  if (!snapshot.catalogueAvailable || !snapshot.peopleLinksAvailable) throw new Error("incomplete");
  let photos = snapshot.catalogue.filter(i => i.kind === "Photograph" && !i.archivedAt);
  if (params.needs === "1") photos = photos.filter(needsInformation);
  const requested = Number(params.page);
  const page = Math.max(1, Math.min(Math.ceil(photos.length / 12) || 1, Number.isFinite(requested) ? Math.floor(requested) : 1));
  const items = photos.slice((page-1)*12, page*12);
  const context = await quickContext(snapshot.archive.id, items.map(i => i.id));
  const role = snapshot.members.find(m => m.profileId === snapshot.profileId && m.status === "active")?.role || "viewer";
  const visible = new Set(items.map(i => i.id));
  return {
    archiveId: snapshot.archive.id, items, people: snapshot.people, places: places.places,
    placeLinks: places.links.filter(l => visible.has(l.item_id)), ...context, role, profileId: snapshot.profileId,
    names: Object.fromEntries(snapshot.members.map(m => [m.profileId, m.name])),
    editableIds: items.filter(i => i.ingestionStatus === "ready" &&
      (["editor","admin"].includes(role) || (role === "contributor" && i.contributedBy === snapshot.profileId && i.certainty !== "verified"))).map(i => i.id),
    page, total: photos.length, needsOnly: params.needs === "1",
  };
}
export default async function QuickCataloguePage({searchParams}: {searchParams: Promise<Params>}) {
  if (isDemoMode()) return <div className="page-shell"><h1>Quick catalogue</h1><p>This workflow uses your private archive. Sign in with real archive mode to save People, dates, Places and conversation.</p><Link href="/explore">Back to Explore ↗</Link></div>;
  const params = await searchParams;
  const snapshot = await loadWorkspace({materialOnly: true, archiveId: params.archive});
  if (!snapshot) notFound();
  const data = await loadQuickData(snapshot, params).catch(() => null);
  if (!data) return <div className="page-shell"><h1>Quick catalogue</h1><p role="alert">Photograph details could not load completely. Reload to retry; no changes have been made.</p><Link href={`/explore?archive=${snapshot.archive.id}`}>Back to Explore ↗</Link></div>;
  return <div className="page-shell"><QuickCatalogue key={`${data.archiveId}:${data.page}:${data.needsOnly}`} {...data} /></div>;
}
