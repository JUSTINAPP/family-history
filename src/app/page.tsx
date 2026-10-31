import { isDemoMode } from "@/lib/supabase/config";
import { LiveHome } from "@/components/live/live-home";
import Link from "next/link";
import { ArrowDown, ArrowUpRight, Plus, Asterisk } from "lucide-react";
import {
  ArchiveImage,
  Eyebrow,
  TextLink,
  ButtonLink,
  ItemCard,
} from "@/components/ui";
import { items } from "@/lib/data";
export default function Home() {
  if (!isDemoMode()) return <LiveHome />;
  return (
    <>
      <section className="home-hero">
        <div className="hero-copy">
          <Eyebrow>
            <span className="tiny-dot" /> OUR SHARED HISTORY. STILL UNFOLDING.
          </Eyebrow>
          <h1>
            An archive,
            <br />
            still being
            <br />
            <em>discovered.</em>
          </h1>
          <p>
            Photographs, letters, documents and objects from our family and
            friends. Explore, contribute and help keep the stories alive.
          </p>
          <ButtonLink href="/explore">Explore the archive</ButtonLink>
          <div className="hero-footnote">
            <span className="short-rule" /> The extraordinary, in the everyday.
          </div>
        </div>
        <div
          className="hero-collage"
          aria-label="A selection of photographs and letters from the demo archive"
        >
          <Link href="/archive/a-letter-from-home" className="collage-letter">
            <ArchiveImage
              src="/images/letter.jpg"
              alt="A folded handwritten letter from the archival illustration collection"
              priority
            />
          </Link>
          <Link
            href="/archive/janice-in-the-garden"
            className="collage-portrait"
          >
            <ArchiveImage
              src="/images/garden.jpg"
              alt="A woman in a garden, black and white archival photograph"
              priority
            />
            <span>01 / A moment, kept.</span>
          </Link>
          <Link href="/archive/a-day-at-the-beach" className="collage-beach">
            <ArchiveImage
              src="/images/beach.jpg"
              alt="Family gathered at Bondi Beach in a historical photograph"
              priority
            />
          </Link>
          <Link
            href="/archive/a-postcard-to-margaret"
            className="collage-postcard"
          >
            <ArchiveImage
              src="/images/postcard.svg"
              alt="A simple demonstration postcard"
            />
          </Link>
          <span className="collage-star" aria-hidden="true">
            <Asterisk strokeWidth={1} size={80} />
          </span>
          <span className="collage-caption">
            Small things.
            <br />
            Whole lives.
          </span>
          <span className="collage-index">
            FROM THE FAMILY COLLECTION / 001—008
          </span>
        </div>
      </section>
      <div className="home-divider">
        <span>Every piece has a story.</span>
        <a href="#ways-in">
          Find your way in <ArrowDown size={15} />
        </a>
      </div>
      <section className="category-section section-pad" id="ways-in">
        <div className="section-top">
          <Eyebrow>THE COLLECTION</Eyebrow>
          <span className="muted-small">Many ways into the same story.</span>
        </div>
        <div className="category-list">
          {[
            [
              "Photographs",
              "A moment, held still.",
              "/explore?type=Photograph",
              "/images/beach.jpg",
            ],
            [
              "Letters",
              "In their own words.",
              "/explore?type=Letter",
              "/images/letter.jpg",
            ],
            [
              "People",
              "The familiar. The not-yet-known.",
              "/people",
              "/images/family.jpg",
            ],
            ["Places", "Where life happened.", "/places", "/images/sydney.jpg"],
            [
              "Stories",
              "The threads between things.",
              "/stories",
              "/images/picnic.jpg",
            ],
          ].map(([title, copy, href, img], i) => (
            <Link href={href} className="category-row" key={title}>
              <span className="category-number">0{i + 1}</span>
              <h2>{title}</h2>
              <p>{copy}</p>
              <div className="category-preview">
                <ArchiveImage src={img} alt="" />
              </div>
              <ArrowUpRight strokeWidth={1.2} />
            </Link>
          ))}
        </div>
      </section>
      <section className="recent-section section-pad">
        <div className="section-top baseline">
          <div>
            <Eyebrow>THE ARCHIVE, GROWING</Eyebrow>
            <h2 className="section-title">
              Recently added<span className="small-dot">.</span>
            </h2>
          </div>
          <TextLink href="/explore">View everything</TextLink>
        </div>
        <div className="recent-grid">
          {[items[1], items[0], items[4], items[3]].map((item, i) => (
            <ItemCard key={item.id} item={item} index={i} />
          ))}
        </div>
      </section>
      <section className="story-feature">
        <div className="story-feature-image">
          <ArchiveImage
            src="/images/beach.jpg"
            alt="A family afternoon on the beach"
          />
          <span className="photo-credit">
            A SUMMER AFTERNOON / FROM THE DEMO COLLECTION
          </span>
        </div>
        <div className="story-feature-copy">
          <Eyebrow>A STORY FROM THE ARCHIVE</Eyebrow>
          <h2>
            The summers
            <br />
            we remember.
          </h2>
          <p>
            A few photographs. A handful of letters. The little rituals that
            made a summer ours.
          </p>
          <TextLink href="/stories/the-summers-we-remember">
            Follow the story
          </TextLink>
          <span className="feature-number">№ 01</span>
        </div>
      </section>
      <section className="explore-by section-pad">
        <div>
          <Eyebrow>MAKE A CONNECTION</Eyebrow>
          <h2 className="section-title">Explore by</h2>
          <p>
            Start with a name, a place,
            <br />
            or a little curiosity.
          </p>
        </div>
        <div className="explore-links">
          {[
            ["People", "/people"],
            ["Places", "/places"],
            ["Years", "/explore?group=years"],
            ["Families", "/explore?group=families"],
            ["Collections", "/explore?group=collections"],
            ["Unidentified", "/explore?unidentified=true"],
          ].map(([name, href]) => (
            <Link key={name} href={href}>
              {name}
              <ArrowUpRight size={23} strokeWidth={1} />
            </Link>
          ))}
        </div>
      </section>
      <section className="contribute-band">
        <Plus size={37} strokeWidth={1} />
        <div>
          <h2>There’s more in your shoebox.</h2>
          <p>
            A photograph, a letter, a name you remember. Every little piece
            belongs.
          </p>
        </div>
        <TextLink href="/add">Add something to the archive</TextLink>
      </section>
    </>
  );
}
