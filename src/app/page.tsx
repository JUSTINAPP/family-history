import { cookies } from "next/headers";
import Link from "next/link";
import { isDemoMode } from "@/lib/supabase/config";
import { LiveHome } from "@/components/live/live-home";
import { ArchiveImage, TextLink } from "@/components/ui";
import { items } from "@/lib/data";
import { HOME_VISIT_COOKIE, homeVisitHash } from "@/lib/home-visit";

export default async function Home() {
  if (!isDemoMode()) return <LiveHome />;
  // The existing explicit demo remains isolated from the authenticated live path.
  const seed = (await cookies()).get(HOME_VISIT_COOKIE)?.value || "demo";
  const featured = [...items].sort((a, b) => homeVisitHash(`${seed}:${a.id}`) - homeVisitHash(`${seed}:${b.id}`)).slice(0, 3);
  return (
    <div className="page-shell scrapbook-home" data-arrangement={homeVisitHash(seed) % 3}>
      <div className="section-top scrapbook-heading"><h1>From the collection</h1></div>
      <section className="home-scrapbook" data-count={featured.length} aria-label="Illustrative demo material">
        {featured.map((item, index) => <article className={`scrapbook-piece scrapbook-piece-${index}`} key={item.id}>
          <ArchiveImage src={item.image} alt={item.alt} href={`/archive/${item.slug}`} priority={index === 0}
            sizes={index === 0 ? "(max-width: 600px) 86vw, 42vw" : "(max-width: 600px) 40vw, 27vw"} />
          <Link prefetch={false} href={`/archive/${item.slug}`} className="scrapbook-caption"><span>{item.kind} · Demo</span><h2>{item.title}</h2></Link>
        </article>)}
      </section>
      <div className="home-browse-actions"><Link className="button" href="/explore">Explore the collection <span aria-hidden="true">↗</span></Link></div>
      <section className="scrapbook-recent" aria-labelledby="recent-title">
        <div className="section-top baseline"><h2 id="recent-title">Recently added</h2><TextLink href="/explore">View everything</TextLink></div>
        <div className="scrapbook-recent-list">{[items[1], items[0], items[4], items[3]].map(item => <article key={item.id}>
          <ArchiveImage src={item.image} alt={item.alt} href={`/archive/${item.slug}`} />
          <Link href={`/archive/${item.slug}`}><h3>{item.title}</h3><span className="muted-small">{item.kind} · {item.date}</span></Link>
        </article>)}</div>
      </section>
      <p className="help-line">Illustrative demo · Names and stories are fictional.</p>
    </div>
  );
}
