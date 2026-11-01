import { isDemoMode } from "@/lib/supabase/config";
import { EmptyFeature } from "@/components/live/empty-feature";
import { places, items } from "@/lib/data";
import { ArchiveImage, PageIntro, TextLink } from "@/components/ui";
import { loadWorkspace } from "@/lib/backend/repository";
import { loadPlaceData } from "@/lib/backend/places";
import { placeMaterials } from "@/lib/places";
import { PlacesOverview } from "@/components/live/places-overview";
import { PlaceEditor } from "@/components/live/place-editor";
import { can } from "@/lib/permissions";
import { notFound } from "next/navigation";
import { reportRender } from "@/lib/backend/performance";
export const metadata = { title: "Places" };
export default async function Places({
  searchParams,
}: {
  searchParams: Promise<{ archive?: string }>;
}) {
  if (!isDemoMode()) {
    const snapshot = await loadWorkspace({
      archiveId: (await searchParams).archive,
      materialOnly: true,
    });
    if (!snapshot) notFound();
    let data;
    try {
      data = await loadPlaceData(snapshot.archive.id);
    } catch {
      return (
        <EmptyFeature
          title="Places"
          description="Places could not load. Reload to retry."
        />
      );
    }
    const role =
      snapshot.members.find(
        (m) => m.profileId === snapshot.profileId && m.status === "active",
      )?.role || "viewer";
    const materials = placeMaterials(
      snapshot.catalogue,
      data.links,
      snapshot.archive.id,
    );
    reportRender("places");
    return (
      <>
        {can(role, "editor") && (
          <div
            className="page-shell"
            style={{ paddingBottom: 0, paddingTop: 25 }}
          >
            <PlaceEditor archiveId={snapshot.archive.id} />
          </div>
        )}
        {(!snapshot.catalogueAvailable ||
          snapshot.peopleLinksAvailable === false) && (
          <p className="notice">
            Some linked material could not load. Reload to retry.
          </p>
        )}
        <PlacesOverview
          places={data.places}
          materials={materials}
          archiveId={snapshot.archive.id}
        />
      </>
    );
  }
  return (
    <div className="page-shell">
      <PageIntro
        eyebrow="A SENSE OF PLACE"
        title="Where life happened."
        description="Browse places and the material linked to them."
      />
      <div className="place-grid">
        {places.map((p) => (
          <article className="place-card" key={p.slug}>
            <ArchiveImage
              src={p.image}
              alt={`Illustrative archival view for ${p.name}`}
            />
            <h2>{p.name}</h2>
            <p>{p.description}</p>
            <TextLink href={`/places/${p.slug}`}>
              {items.filter((i) => i.place === p.name).length} pieces of the
              story
            </TextLink>
          </article>
        ))}
      </div>
    </div>
  );
}
