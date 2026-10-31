import { isDemoMode } from "@/lib/supabase/config";
import { notFound } from "next/navigation";
import { places, items } from "@/lib/data";
import { PageIntro, ArchiveImage, ItemCard } from "@/components/ui";
export function generateStaticParams() {
  return places.map((p) => ({ slug: p.slug }));
}
export default async function PlacePage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  if (!isDemoMode()) notFound();
  const { slug } = await params;
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
