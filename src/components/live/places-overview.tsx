import Link from "next/link";
import { PageIntro } from "../ui";
import { PersonMaterialStack } from "../person-material-stack";
import { placeSubtitle, type ArchivePlace } from "@/lib/places";
import type { PersonMaterial } from "@/lib/people-material";
export function PlacesOverview({
  places,
  materials,
  archiveId,
}: {
  places: ArchivePlace[];
  materials: Record<string, PersonMaterial>;
  archiveId: string;
}) {
  return (
    <div className="page-shell">
      <PageIntro
        eyebrow="PLACES IN THE COLLECTION"
        title="Places"
        description="Browse places and the material linked to them."
      />
      <div className="people-grid archival-people-grid places-archive-grid">
        {places.map((place) => (
          <Link
            prefetch={false}
            key={place.id}
            href={`/places/${place.id}?archive=${archiveId}`}
            className="person-card place-archive-card"
          >
            <PersonMaterialStack
              items={materials[place.id]?.items || []}
              count={materials[place.id]?.count || 0}
              name={place.name}
            />
            <h2>{place.name}</h2>
            <p className="help-line">{placeSubtitle(place)}</p>
            <p className="person-material-count">
              {materials[place.id]?.count || 0} linked{" "}
              {(materials[place.id]?.count || 0) === 1 ? "item" : "items"}
            </p>
          </Link>
        ))}
      </div>
      {!places.length && (
        <p className="notice">
          No Places have been catalogued in this archive yet. A name is enough
          to begin.
        </p>
      )}
    </div>
  );
}
