import { ConversationLink } from "../conversation-link";
import Link from "next/link";
import { ArchiveImage, TextLink } from "../ui";
import { loadWorkspace } from "@/lib/backend/repository";
import { loadPlaceData, workspaceWithPlaces } from "@/lib/backend/places";
import { homeMaterial } from "@/lib/home-material";
import { reportRender } from "@/lib/backend/performance";
export async function LiveHome() {
  let workspace = await loadWorkspace({ materialOnly: true });
  if (!workspace) return null;
  try { workspace = workspaceWithPlaces(workspace, await loadPlaceData(workspace.archive.id)); } catch { /* Core material remains available if Place context is unavailable. */ }
  const material = homeMaterial(workspace.catalogue);
  const recent = [...workspace.catalogue].sort((a,b) => (b.createdAt || "").localeCompare(a.createdAt || "") || b.id.localeCompare(a.id)).slice(0, 4);
  reportRender("home");
  return (
    <div className="page-shell scrapbook-home">
      <div className="section-top baseline scrapbook-heading">
        <h1 className="eyebrow">From the archive</h1>
        <TextLink href={`/add?archive=${workspace.archive.id}`}>Add something</TextLink>
      </div>
      <p className="home-help"><Link prefetch={false} className="text-link" href={`/quick-catalogue?archive=${workspace.archive.id}`}>Help identify photographs ↗</Link></p>
      {!workspace.catalogueAvailable ? (
        <p className="notice">The item list could not load. Saved items have not been removed. <Link href={`/explore?archive=${workspace.archive.id}`}>Retry View everything ↗</Link></p>
      ) : !workspace.catalogue.length ? (
        <section className="empty-state"><h2>The first piece is waiting.</h2><p>A photograph, a letter, a little of what you remember.</p><Link className="button" href="/add">Capture something</Link></section>
      ) : <>
        {!!material.length && <section className="home-scrapbook" aria-label="Material from your archive">
          {material.map((item, index) => <article className={`scrapbook-piece scrapbook-piece-${index % 6}`} key={item.id}>
            <ArchiveImage src={item.image} alt={item.title} href={item.href}
              imageSet={item.imageSet} rotation={item.rotation} variant="small" autoPrepare={false} priority={index < 2}
              sizes="(max-width: 650px) 80vw, (max-width: 1000px) 45vw, 380px" />
            <Link prefetch={false} href={item.href!} className="scrapbook-caption"><span>{item.kind}</span><h2>{item.title}</h2></Link>
            <ConversationLink item={item} />
          </article>)}
        </section>}
        <section className="scrapbook-recent" aria-labelledby="recent-title">
          <div className="section-top baseline"><h2 className="section-title" id="recent-title">Recently added.</h2><TextLink href={`/explore?archive=${workspace.archive.id}`}>View everything</TextLink></div>
          <div className="scrapbook-recent-list">{recent.map(item => <article key={item.id}>
            {item.imageSet ? <ArchiveImage src={item.image} imageSet={item.imageSet} rotation={item.rotation} variant="small" autoPrepare={false} alt={item.title} href={item.href} />
              : <Link prefetch={false} href={item.href!} className="scrapbook-preview-pending">{item.kind === "Audio" ? "Voice recollection" : "Preview pending"}</Link>}
            <Link prefetch={false} href={item.href!}><h3>{item.title}</h3><span className="muted-small">{item.kind} · {item.date}</span></Link>
          </article>)}</div>
        </section>
      </>}
    </div>
  );
}
