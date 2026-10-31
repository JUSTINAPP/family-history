import { isDemoMode } from "@/lib/supabase/config";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowUpRight } from "lucide-react";
import { story, items } from "@/lib/data";
import { Eyebrow, ArchiveImage, ItemCard } from "@/components/ui";
export function generateStaticParams() {
  return [{ slug: story.slug }];
}
export const metadata = { title: "The summers we remember" };
export default async function StoryPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  if (!isDemoMode()) notFound();
  if ((await params).slug !== story.slug) notFound();
  return (
    <div className="page-shell">
      <div className="breadcrumb">
        <Link href="/stories">Stories</Link>
        <span>/</span>
        <span>№ 01</span>
      </div>
      <header className="story-header">
        <Eyebrow>AN EDITORIAL STORY · 3 SOURCE ITEMS</Eyebrow>
        <h1>
          The summers
          <br />
          we remember.
        </h1>
        <p>{story.subtitle}</p>
      </header>
      <ArchiveImage
        className="story-wide-image"
        src={story.image}
        alt="A historical family beach photograph, illustrative demo source"
        priority
      />
      <div className="story-body">
        <p
          className="demo-note"
          style={{ fontFamily: "var(--sans)", fontSize: 11 }}
        >
          Fictional demo narrative. Names, dates and connections are examples,
          not a historical account of the pictured people.
        </p>
        <h2>It was never just the sea.</h2>
        <p>
          It was the getting ready. The towels counted twice, the sandwiches
          wrapped, Arthur looking for his camera when everyone else was already
          at the door.
        </p>
        <p>
          In the family’s telling, a day at the beach was a small expedition.
          There was always too much to carry, and somehow always someone with a
          free hand.
        </p>
        <Link className="source-ref" href="/archive/a-day-at-the-beach">
          01 / A day at the beach
          <ArrowUpRight size={14} />
        </Link>
      </div>
      <div className="story-body">
        <h2>“She is still talking about our day at the beach.”</h2>
        <p>
          That little line in Margaret’s letter is the thread. Not a grand
          occasion, just a day that stayed with someone long enough to write it
          down.
        </p>
        <Link className="source-ref" href="/archive/a-letter-from-home">
          02 / A letter from home · demo text, page 2<ArrowUpRight size={14} />
        </Link>
        <p style={{ marginTop: 35 }}>
          The archive cannot tell us everything. Who took the photograph? What
          happened after? There are gaps. Sometimes keeping a story means
          keeping its questions, too.
        </p>
        <Link className="source-ref" href="/archive/a-postcard-to-margaret">
          03 / A postcard to Margaret
          <ArrowUpRight size={14} />
        </Link>
      </div>
      <section style={{ borderTop: "1px solid var(--line)", paddingTop: 40 }}>
        <Eyebrow>BACK TO THE MATERIAL</Eyebrow>
        <h2 className="section-title" style={{ marginBottom: 35 }}>
          The pieces of this story.
        </h2>
        <div
          className="recent-grid"
          style={{ gridTemplateColumns: "repeat(3,1fr)" }}
        >
          {story.itemSlugs.map((slug, i) => (
            <ItemCard
              item={items.find((item) => item.slug === slug)!}
              key={slug}
              index={i}
            />
          ))}
        </div>
      </section>
    </div>
  );
}
