"use client";
import { useState } from "react";
import { ArchiveImage } from "../archive-image";
import { pageLabel } from "@/lib/documents/types";
import type { ImageSet } from "@/lib/preview/types";
export function DocumentReader({pages, sets, title}: {
  pages: {id: string; page_role: string; page_order: number; original_filename: string; sha256: string; byte_size: number}[];
  sets: ImageSet[]; title: string;
}) {
  const [selected, setSelected] = useState(0), [enlarged, setEnlarged] = useState(false);
  const current = pages[Math.min(selected, pages.length-1)];
  if (!current) return <p>Page images are not available yet.</p>;
  const label = pageLabel(current.page_role, selected);
  return <section className={`document-reader ${enlarged ? "document-enlarged" : ""}`} aria-label="Document pages">
    <nav className="quick-navigation" aria-label="Document page navigation">
      <button className="subtle-button" disabled={!selected} onClick={() => setSelected(selected-1)}>Previous page</button>
      <span aria-live="polite">{label} · {selected+1} of {pages.length}</span>
      <button className="subtle-button" disabled={selected>=pages.length-1} onClick={() => setSelected(selected+1)}>Next page</button>
      <button className="subtle-button" onClick={() => setEnlarged(!enlarged)}>{enlarged ? "Fit page" : "Enlarge page"}</button>
    </nav>
    <ArchiveImage key={current.id} className="saved-original document-page" src={`/api/v1/previews/${current.id}`} alt={`${title} · ${label}`} imageSet={sets.find(s => s.originalId===current.id)} priority originalPreserved />
    <nav className="document-thumbnails" aria-label="Choose a document page">{pages.map((p,i) => <button className="subtle-button" key={p.id} aria-current={i===selected ? "true" : undefined} onClick={() => {setSelected(i);setEnlarged(false);}}>
      <ArchiveImage src={`/api/v1/previews/${p.id}`} imageSet={sets.find(s => s.originalId===p.id)} variant="small" autoPrepare={false} alt="" />
      {i+1} — {pageLabel(p.page_role,i)}
    </button>)}</nav>
    <details className="archive-information"><summary>Original file information</summary><div className="saved-file-list">
      {pages.map((p,i) => <p key={p.id}><a href={`/api/v1/files/${p.id}`} download={p.original_filename}>{i+1} · {p.original_filename} ↗</a><br />
        <small>{Number(p.byte_size).toLocaleString("en-AU")} bytes · SHA-256 {p.sha256}</small></p>)}
    </div></details>
  </section>;
}
