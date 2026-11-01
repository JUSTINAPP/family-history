import { isDemoMode } from "@/lib/supabase/config";
import { loadWorkspace } from "@/lib/backend/repository";
import { PageIntro } from "@/components/ui";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowUpRight } from "lucide-react";
import { people, items } from "@/lib/data";
import { ArchiveImage, Eyebrow, ItemCard, TextLink } from "@/components/ui";
export function generateStaticParams() {
  return people.map((p) => ({ slug: p.slug }));
}
export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  return { title: people.find((p) => p.slug === slug)?.name || "Person" };
}
export default async function PersonPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ archive?: string }>;
}) {
  const { slug } = await params;
  if (!isDemoMode()) {
    const data = await loadWorkspace({
      archiveId: (await searchParams).archive,
    });
    const p = data?.people.find(
      (person) => person.slug === slug || person.id === slug,
    );
    if (!p) notFound();
    return (
      <div className="page-shell">
        <PageIntro
          eyebrow={p.category}
          title={p.name}
          description={
            p.bio ||
            "A person represented in this archive. No account is required."
          }
        />
        <p className="prose">{p.lifespan}</p>
        <p className="demo-note">
          Reported record · not automatically verified. Membership and
          historical identity are separate.
        </p>
        <section aria-label="Items featuring this Person">
          <h2>Photographs and archive items featuring {p.name}</h2>
          {data?.peopleLinksAvailable === false ||
          data?.catalogueAvailable === false ? (
            <p>Linked items could not load completely. Reload to retry.</p>
          ) : (
            <>
              <p>
                Reported and Editor-confirmed associations. Unlinked name
                reports do not appear here.
              </p>
              <div className="recent-grid">
                {data?.catalogue
                  .filter((item) => item.people.includes(p.id))
                  .map((item, index) => (
                    <ItemCard key={item.id} item={item} index={index} />
                  ))}
              </div>
              {!data?.catalogue.some((item) => item.people.includes(p.id)) && (
                <p>No archive items linked yet.</p>
              )}
              <Link
                href={`/explore?archive=${data?.archive.id}&person=${p.id}`}
              >
                Explore items featuring {p.name} ↗
              </Link>
            </>
          )}
        </section>
      </div>
    );
  }
  const person = people.find((p) => p.slug === slug);
  if (!person) notFound();
  const related = items.filter((i) => i.people.includes(slug));
  const isJanice = slug === "janice-allen";
  return (
    <div className="page-shell">
      <div className="breadcrumb">
        <Link href="/people">People</Link>
        <span>/</span>
        <span>{person.name}</span>
      </div>
      <section className="person-hero">
        <ArchiveImage
          src={person.image}
          alt={`Illustrative portrait for ${person.name}`}
          position={person.position}
          priority
        />
        <div>
          <Eyebrow>{person.category} · A LIFE IN THE ARCHIVE</Eyebrow>
          <h1>{person.name}</h1>
          <p className="person-lifespan">{person.lifespan}</p>
          <p className="prose">{person.bio}</p>
          <TextLink href={`/explore?q=${encodeURIComponent(person.name)}`}>
            Explore their {related.length} items
          </TextLink>
          <p className="demo-note">
            Fictional demo biography. The photograph is illustrative.
          </p>
        </div>
      </section>
      <section className="two-col-section">
        <h2>In photographs</h2>
        <div className="recent-grid" style={{ gridTemplateColumns: "1fr 1fr" }}>
          {related
            .filter((i) => i.kind === "Photograph")
            .slice(0, 2)
            .map((i, index) => (
              <ItemCard key={i.id} item={i} index={index} />
            ))}
        </div>
      </section>
      <section className="two-col-section">
        <h2>In their own words</h2>
        <div>
          <div className="metadata-grid">
            <div>
              <h3 className="eyebrow">Letters written</h3>
              <div className="inline-links">
                {slug === "margaret-wilson" ? (
                  <Link href="/archive/a-letter-from-home">
                    A letter from home <ArrowUpRight size={16} />
                  </Link>
                ) : (
                  <p className="help-line">No letters catalogued yet.</p>
                )}
              </div>
            </div>
            <div>
              <h3 className="eyebrow">Letters received</h3>
              {isJanice ? (
                <div className="inline-links">
                  <Link href="/archive/a-letter-from-home">
                    A letter from home <ArrowUpRight size={16} />
                  </Link>
                </div>
              ) : (
                <p className="help-line">No letters catalogued yet.</p>
              )}
            </div>
          </div>
        </div>
      </section>
      <section className="two-col-section">
        <h2>Places in a life</h2>
        <div className="inline-links">
          {[...new Set(related.map((i) => i.place))].map((place) => (
            <Link
              href={`/explore?place=${encodeURIComponent(place)}`}
              key={place}
            >
              {place}
              <ArrowUpRight size={16} />
            </Link>
          ))}
        </div>
      </section>
      <section className="two-col-section">
        <h2>A little timeline</h2>
        <div>
          <p className="help-line" style={{ margin: "0 0 15px" }}>
            Illustrative milestones · dates reported by family, awaiting source
            review.
          </p>
          <ol className="timeline-list">
            {isJanice ? (
              <>
                <li>
                  <span>1932</span>
                  <div>Born in Sydney</div>
                </li>
                <li>
                  <span>c. 1952</span>
                  <Link href="/archive/janice-in-the-garden">
                    An afternoon in the gardens ↗
                  </Link>
                </li>
                <li>
                  <span>1956</span>
                  <Link href="/archive/a-letter-from-home">
                    A letter from Margaret arrives ↗
                  </Link>
                </li>
                <li>
                  <span>1962</span>
                  <Link href="/archive/a-postcard-to-margaret">
                    A postcard from the Blue Mountains ↗
                  </Link>
                </li>
              </>
            ) : (
              related.map((i) => (
                <li key={i.id}>
                  <span>{i.year || "Unknown"}</span>
                  <Link href={`/archive/${i.slug}`}>{i.title} ↗</Link>
                </li>
              ))
            )}
          </ol>
        </div>
      </section>
      <section className="two-col-section">
        <h2>Family & connections</h2>
        <div>
          {person.category === "Family" ? (
            <>
              <div className="inline-links">
                {people
                  .filter((p) => p.category === "Family" && p.slug !== slug)
                  .map((p) => (
                    <Link href={`/people/${p.slug}`} key={p.id}>
                      {p.name}
                      <ArrowUpRight size={16} />
                    </Link>
                  ))}
              </div>
              <p className="help-line">
                {isJanice
                  ? "Margaret · mother. Arthur · partner. Reported by family; not yet verified."
                  : "Family connections are reported by family and await source review."}
              </p>
              <div style={{ marginTop: 20 }}>
                <TextLink href="/tree">View the family tree</TextLink>
              </div>
            </>
          ) : (
            <p className="prose">
              A person connected to the archive. No family relationship has been
              assumed.
            </p>
          )}
        </div>
      </section>
      <section className="two-col-section">
        <h2>Part of the story</h2>
        <div>
          <TextLink href="/stories/the-summers-we-remember">
            The summers we remember
          </TextLink>
          <p className="help-line">
            An editorial demo story, with links back to its source material.
          </p>
        </div>
      </section>
    </div>
  );
}
