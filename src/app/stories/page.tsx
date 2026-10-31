import { isDemoMode } from "@/lib/supabase/config";
import { EmptyFeature } from "@/components/live/empty-feature";
import { PageIntro, ArchiveImage, Eyebrow, TextLink } from "@/components/ui";
export const metadata = { title: "Stories" };
export default function Stories() {
  if (!isDemoMode())
    return (
      <EmptyFeature
        title="There’s a story here."
        description="Curated stories will be connected to your own source material in a later step."
      />
    );
  return (
    <div className="page-shell">
      <PageIntro
        eyebrow="THE THREADS BETWEEN THINGS"
        title="There’s a story here."
        description="Photographs become moments. Letters become voices. A few pieces, brought together."
      />
      <article className="story-index">
        <ArchiveImage
          src="/images/beach.jpg"
          alt="Family gathered on a beach in a historical photograph"
          priority
        />
        <div>
          <Eyebrow>STORY № 01 · 3 SOURCE ITEMS</Eyebrow>
          <h2>
            The summers
            <br />
            we remember.
          </h2>
          <p>
            A few photographs. A handful of letters. A lifetime of going back to
            the sea.
          </p>
          <TextLink href="/stories/the-summers-we-remember">
            Read the story
          </TextLink>
        </div>
      </article>
      <p className="demo-note">
        Stories are interpretations of the collection. The original sources stay
        a click away.
      </p>
    </div>
  );
}
