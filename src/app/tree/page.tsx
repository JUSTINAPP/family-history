import { isDemoMode } from "@/lib/supabase/config";
import { EmptyFeature } from "@/components/live/empty-feature";
import Link from "next/link";
import { people } from "@/lib/data";
import { ArchiveImage, PageIntro, TextLink } from "@/components/ui";
export const metadata = { title: "Family connections" };
function TreePerson({ slug, relation }: { slug: string; relation: string }) {
  const p = people.find((p) => p.slug === slug)!;
  return (
    <Link className="tree-person" href={`/people/${slug}`}>
      <ArchiveImage
        src={p.image}
        alt={`Illustrative portrait for ${p.name}`}
        position={p.position}
      />
      <h2>{p.name}</h2>
      <p>{p.lifespan}</p>
      <p>{relation}</p>
    </Link>
  );
}
export default function Tree() {
  if (!isDemoMode())
    return (
      <EmptyFeature
        title="The ties between us."
        description="Relationships will be added from reviewed records, rather than inferred from membership."
      />
    );
  return (
    <div className="page-shell">
      <PageIntro
        eyebrow="ONE WAY INTO THE ARCHIVE"
        title="The ties between us."
        description="A few family connections, with room for the story to grow. The archive holds friends and other lives beyond this view, too."
      />
      <div className="tree-toolbar">
        <span className="pill">The Allen & Wilson families</span>
        <TextLink href="/people">Meet everyone in the archive</TextLink>
      </div>
      <section
        className="tree-canvas"
        aria-label="Margaret Wilson is Janice Allen’s mother. Janice and Arthur Allen are partners."
      >
        <p className="tree-caption">GENERATION 01</p>
        <div className="tree-generation">
          <TreePerson slug="margaret-wilson" relation="Janice’s mother" />
        </div>
        <div className="tree-generation">
          <TreePerson slug="janice-allen" relation="Margaret’s daughter" />
          <TreePerson slug="arthur-allen" relation="Janice’s partner" />
        </div>
      </section>
      <p className="demo-note">
        Preliminary family view. Connections are fictional examples, marked as
        reported by family and awaiting verification. Family relationships are
        separate records; they do not define the archive’s structure.
      </p>
    </div>
  );
}
