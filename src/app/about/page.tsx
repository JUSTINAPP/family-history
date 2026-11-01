import { isDemoMode } from "@/lib/supabase/config";
import Link from "next/link";
export const metadata = { title: "About the demo material" };
const commons = "https://commons.wikimedia.org/wiki/File:";
export default function About() {
  if (!isDemoMode())
    return (
      <article className="long-doc">
        <p className="eyebrow">YOUR PRIVATE ARCHIVE</p>
        <h1>About the archive</h1>
        <p>
          Uploaded photographs and documents are stored as untouched originals
          in private Storage. Your words are preserved separately as contributor
          recollections, with no automatic verification or AI processing.
        </p>
        <p>
          Access belongs to each archive membership. People represented in the
          collection are historical records, separate from member accounts.
        </p>
        <p>
          Voice recording remains a clearly labelled example. Email invitations,
          image processing and AI services are not connected yet.
        </p>
        <p>
          <Link href="/explore">Return to your archive ↗</Link>
        </p>
      </article>
    );

  return (
    <article className="long-doc">
      <p className="eyebrow">THE MATERIAL & ITS CONTEXT</p>
      <h1>A note on this little archive.</h1>
      <p>
        This archive is a working visual prototype. All names, family
        relationships, dates, biographies, provenance statements, stories and
        transcription text in the interface are fictional examples. They are not
        a historical account of the people pictured.
      </p>
      <h2>Real material. Illustrative connections.</h2>
      <p>
        The photographs and letter scans are public-domain archival images used
        to explore the design. They do not belong to the demo family. The camera
        and postcard are neutral, clearly labelled illustrations. No artificial
        ageing, image restoration or generated historical photographs have been
        used.
      </p>
      <ul>
        <li>
          <a href={commons + encodeURIComponent("SLNSW 15638 Bondi Beach.jpg")}>
            Bondi Beach
          </a>{" "}
          — Mitchell Library, State Library of New South Wales.
        </li>
        <li>
          <a
            href={
              commons +
              encodeURIComponent(
                "A woman in the Botanic Gardens, 13 Sept. 1934, by Sam Hood (13707902265).jpg",
              )
            }
          >
            A woman in the Botanic Gardens
          </a>{" "}
          — Sam Hood, 1934. Mitchell Library, State Library of New South Wales.
        </li>
        <li>
          <a
            href={
              commons +
              encodeURIComponent(
                'A Nash family picnic, several groups - "Cavanba", 4.5 miles north of Parkes, NSW, c.1910, by Wilfred Nash. (24755003777).jpg',
              )
            }
          >
            Nash family picnic
          </a>{" "}
          — State Library of New South Wales.
        </li>
        <li>
          <a
            href={
              commons +
              encodeURIComponent(
                "A wet Angel Place, Sydney, 1930s - Sam Hood (3293630577).jpg",
              )
            }
          >
            A wet Angel Place, Sydney
          </a>{" "}
          — Sam Hood, c. 1935. Mitchell Library, State Library of New South
          Wales.
        </li>
        <li>
          <a href={commons + encodeURIComponent("The Rivetts Family.jpg")}>
            The Rivetts family
          </a>{" "}
          — public-domain archival group portrait via Wikimedia Commons.
        </li>
        <li>
          <a href="https://www.metmuseum.org/art/collection/search/363088">
            Letter, James Oldham, 26 December 1786
          </a>{" "}
          — The Metropolitan Museum of Art, Gift of A. A. Hopkins, 1927, Museum
          Accession, 1957; 27.212.3. Three Open Access scans illustrate the
          letter viewer. The sample text is not their transcription.
        </li>
      </ul>
      <h2>Private, when connected.</h2>
      <p>
        This prototype has no authentication or server storage. Profile controls
        illustrate future access. Files selected in capture flows remain on your
        device; only temporary browser previews are made. Draft details and
        comments stay in memory and clear when you leave or reload. Exported
        draft JSON contains metadata, not image files.
      </p>
      <p>
        The proposed backend will preserve untouched originals, restrict access
        through archive membership and keep AI suggestions separate from family
        knowledge. It must be connected and its access controls tested before
        you use it for private family material.
      </p>
      <p>
        <Link href="/explore">Return to the archive ↗</Link>
      </p>
    </article>
  );
}
