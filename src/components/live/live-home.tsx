import Link from "next/link";
import { PageIntro, ItemCard, TextLink } from "../ui";
import { loadWorkspace } from "@/lib/backend/repository";
export async function LiveHome() {
  const workspace = await loadWorkspace();
  if (!workspace) return null;
  return (
    <div className="page-shell">
      <PageIntro
        eyebrow="YOUR PRIVATE ARCHIVE"
        title="An archive, still being discovered."
        description={
          workspace.archive.description ||
          "Photographs, letters, documents and objects. Begin with what you have, and add what you know."
        }
      >
        <TextLink href="/add">Add to the archive</TextLink>
      </PageIntro>
      <section style={{ padding: "15px 0 50px" }}>
        <div className="section-top baseline">
          <h2 className="section-title">Recently added.</h2>
          <TextLink href="/explore">View everything</TextLink>
        </div>
        {workspace.catalogue.length ? (
          <div className="recent-grid">
            {workspace.catalogue.slice(0, 4).map((item, i) => (
              <ItemCard key={item.id} item={item} index={i} />
            ))}
          </div>
        ) : (
          <div className="empty-state">
            <h2>The first piece is waiting.</h2>
            <p>
              This archive is clean. No fictional photographs or people have
              been imported.
            </p>
            <Link href="/add" className="button">
              Capture something
            </Link>
          </div>
        )}
      </section>
    </div>
  );
}
