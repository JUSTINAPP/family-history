import { ConversationLink } from "../conversation-link";
import Link from "next/link";
import { ArchiveImage, TextLink } from "../ui";
import { loadWorkspace } from "@/lib/backend/repository";
import { loadPlaceData, workspaceWithPlaces } from "@/lib/backend/places";
import { homeMaterial } from "@/lib/home-material";
import { reportRender } from "@/lib/backend/performance";
import { cookies } from "next/headers";
import { HOME_VISIT_COOKIE, homeVisitHash } from "@/lib/home-visit";
export async function LiveHome() {
  let workspace = await loadWorkspace({ materialOnly: true });
  if (!workspace) return null;
  try { workspace = workspaceWithPlaces(workspace, await loadPlaceData(workspace.archive.id)); } catch { /* Core material remains available if Place context is unavailable. */ }
  const visit = `${workspace.archive.id}:${(await cookies()).get(HOME_VISIT_COOKIE)?.value || "initial"}`;
  const material = homeMaterial(workspace.catalogue, 3, visit);
  const recent = [...workspace.catalogue].sort((a,b) => (b.createdAt || "").localeCompare(a.createdAt || "") || b.id.localeCompare(a.id)).slice(0, 4);
  reportRender("home");
  return (
    <div className="page-shell scrapbook-home" data-arrangement={homeVisitHash(visit) % 3}>
      <div className="section-top baseline scrapbook-heading">
        <h1>From the collection</h1>
      </div>
      {!workspace.catalogueAvailable ? (
        <p className="notice">The item list could not load. Saved items have not been removed. <Link href={`/explore?archive=${workspace.archive.id}`}>Retry View everything ↗</Link></p>
      ) : !workspace.catalogue.length ? (
        <section className="empty-state"><h2>No items yet</h2><p>Add photographs, letters, documents or objects to this archive.</p><Link className="button" href="/add">Add to archive</Link></section>
      ) : <>
        {!!material.length && <section className="home-scrapbook" data-count={material.length} aria-label="Material from your archive">
          {material.map((item, index) => <article className={`scrapbook-piece scrapbook-piece-${index % 6}`} key={item.id}>
            <ArchiveImage src={item.image} alt={item.title} href={item.href}
              imageSet={item.imageSet} rotation={item.rotation} variant="small" autoPrepare={false} priority={index < 2}
              sizes={index === 0 ? "(max-width: 600px) 86vw, (max-width: 1000px) 42vw, 460px" : "(max-width: 600px) 40vw, (max-width: 1000px) 27vw, 350px"} />
            <Link prefetch={false} href={item.href!} className="scrapbook-caption"><span>{item.kind}</span><h2>{item.title}</h2></Link>
            <ConversationLink item={item} />
          </article>)}
        </section>}
        {!material.length && <p className="notice">Items are available below. Image previews are not ready yet.</p>}
        <div className="home-browse-actions">
          <Link prefetch={false} className="button" href={`/explore?archive=${workspace.archive.id}`}>Explore the collection <span aria-hidden="true">↗</span></Link>
          <Link prefetch={false} className="text-link" href={`/quick-catalogue?archive=${workspace.archive.id}`}>Help identify photographs ↗</Link>
        </div>
        <section className="scrapbook-recent" aria-labelledby="recent-title">
          <div className="section-top baseline"><h2 id="recent-title">Recently added</h2><TextLink href={`/explore?archive=${workspace.archive.id}`}>View everything</TextLink></div>
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
