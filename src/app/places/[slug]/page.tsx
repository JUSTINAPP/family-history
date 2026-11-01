import { isDemoMode } from "@/lib/supabase/config";
import { notFound } from "next/navigation";
import { places, items } from "@/lib/data";
import { PageIntro, ArchiveImage, ItemCard } from "@/components/ui";
import Link from "next/link";
import { loadWorkspace } from "@/lib/backend/repository";
import { loadPlaceData, workspaceWithPlaces } from "@/lib/backend/places";
import { placeSubtitle } from "@/lib/places";
import { PlaceEditor } from "@/components/live/place-editor";
import { can } from "@/lib/permissions";
import { reportRender } from "@/lib/backend/performance";
export function generateStaticParams() {
  return places.map((p) => ({ slug: p.slug }));
}
export default async function PlacePage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ archive?: string }>;
}) {
  const { slug } = await params;
  if (!isDemoMode()) {
    const base = await loadWorkspace({
      archiveId: (await searchParams).archive,
      materialOnly: true,
    });
    if (!base) notFound();
    let placeData;
    try {
      placeData = await loadPlaceData(base.archive.id);
    } catch {
      return (
        <div className="page-shell">
          <PageIntro
            eyebrow="PLACES"
            title="Place records could not load."
            description="Reload to retry."
          />
        </div>
      );
    }
    const place = placeData.places.find((p) => p.id === slug);
    if (!place) notFound();
    const data = workspaceWithPlaces(base, placeData),
      related = data.catalogue.filter((item) =>
        item.placeIds?.includes(place.id),
      );
    const peopleIds = new Set(related.flatMap((item) => item.people)),
      connectedPeople = data.people.filter((p) => peopleIds.has(p.id));
    const photos = related.filter((i) => i.kind === "Photograph"),
      documents = related.filter((i) =>
        ["Letter", "Document", "Postcard", "Certificate"].includes(i.kind),
      ),
      other = related.filter(
        (i) => !photos.includes(i) && !documents.includes(i),
      );
    const dated = related
      .filter((i) => i.date && i.date !== "Date not yet known")
      .sort(
        (a, b) =>
          (a.year ?? 9999) - (b.year ?? 9999) || a.id.localeCompare(b.id),
      );
    const role =
      data.members.find(
        (m) => m.profileId === data.profileId && m.status === "active",
      )?.role || "viewer";
    reportRender("place");
    return (
      <div className="page-shell">
        <PageIntro
          eyebrow={placeSubtitle(place) || "A PLACE IN THIS ARCHIVE"}
          title={place.name}
          description={
            place.notes ||
            "A meaningful place, connected through the material we keep."
          }
        />
        {can(role, "editor") && (
          <PlaceEditor archiveId={data.archive.id} place={place} />
        )}
        {!data.catalogueAvailable || data.peopleLinksAvailable === false ? (
          <p className="notice">
            Linked material could not load completely. Reload to retry.
          </p>
        ) : (
          <section aria-label="Items connected to this Place">
            {[
              ["Photographs", photos],
              ["Letters & documents", documents],
              ["Other linked material", other],
            ].map(
              ([title, group]) =>
                Array.isArray(group) &&
                group.length > 0 && (
                  <section
                    className="person-material-section"
                    key={String(title)}
                  >
                    <h2>{String(title)}</h2>
                    <div className="recent-grid">
                      {group.map((item, index) => (
                        <ItemCard key={item.id} item={item} index={index} />
                      ))}
                    </div>
                  </section>
                ),
            )}
            {!!connectedPeople.length && (
              <section className="person-material-section">
                <h2>People appearing in material connected to this place</h2>
                <p>
                  This connection does not establish that someone lived here.
                </p>
                <ul>
                  {connectedPeople.map((person) => (
                    <li key={person.id}>
                      <Link
                        href={`/people/${person.id}?archive=${data.archive.id}`}
                      >
                        {person.name} ↗
                      </Link>
                    </li>
                  ))}
                </ul>
              </section>
            )}
            {!!dated.length && (
              <section className="person-material-section">
                <h2>Dates in the material</h2>
                <ol className="timeline-list">
                  {dated.map((item) => (
                    <li key={item.id}>
                      <span>{item.date}</span>
                      <Link href={item.href || `/archive/${item.id}`}>
                        {item.title} ↗
                      </Link>
                    </li>
                  ))}
                </ol>
              </section>
            )}
            {!related.length && <p>No material linked to this Place yet.</p>}
            <Link
              href={`/explore?archive=${data.archive.id}&place=${place.id}`}
            >
              Explore material connected to {place.name} ↗
            </Link>
          </section>
        )}
      </div>
    );
  }
  const place = places.find((p) => p.slug === slug);
  if (!place) notFound();
  return (
    <div className="page-shell">
      <PageIntro
        eyebrow={place.region}
        title={place.name}
        description={place.description}
      />
      <ArchiveImage
        className="story-wide-image"
        src={place.image}
        alt={`Illustrative historical view for ${place.name}`}
      />
      <div className="section-top" style={{ marginTop: 55 }}>
        <h2 className="section-title">Collected here.</h2>
      </div>
      <div className="recent-grid">
        {items
          .filter((i) => i.place === place.name)
          .map((i, index) => (
            <ItemCard item={i} key={i.id} index={index} />
          ))}
      </div>
      <p className="demo-note">
        Demo locations and associations are illustrative, not verified
        historical claims.
      </p>
    </div>
  );
}
