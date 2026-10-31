import { isDemoMode } from "@/lib/supabase/config";
import { EmptyFeature } from "@/components/live/empty-feature";
import { places, items } from "@/lib/data";
import { ArchiveImage, PageIntro, TextLink } from "@/components/ui";
export const metadata = { title: "Places" };
export default function Places() {
  if (!isDemoMode())
    return (
      <EmptyFeature
        title="A sense of place."
        description="Place cataloguing will connect after the persistent capture foundation."
      />
    );
  return (
    <div className="page-shell">
      <PageIntro
        eyebrow="A SENSE OF PLACE"
        title="Where life happened."
        description="A street, a home, a stretch of coast. Places hold a little of us, too."
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
