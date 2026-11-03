"use client";
import { useState } from "react";
import { ArchiveImage } from "../archive-image";
import type { ArchiveItem } from "@/lib/types";
export function AudioItemLinkPicker({items, selected, onChange, disabled = false}: {
  items: ArchiveItem[]; selected: string[]; onChange: (ids: string[]) => void; disabled?: boolean;
}) {
  const [query, setQuery] = useState("");
  const candidates = items.filter(item => !item.archivedAt && item.kind !== "Audio");
  const visible = candidates.filter(item => selected.includes(item.id) || `${item.title} ${item.place} ${item.date}`.toLowerCase().includes(query.toLowerCase()));
  return <section className="audio-photo-links" aria-label="Link recording to photos">
    <h2>Attach this recording to photos</h2>
    <p>Choose one or more photos or archive items. The recording will appear with each one; the original audio stays unchanged.</p>
    <label className="field"><span>Find a photo or item</span><input type="search" value={query} disabled={disabled} onChange={event => setQuery(event.target.value)} placeholder="Search titles, places or dates" /></label>
    <p role="status">{selected.length} linked {selected.length === 1 ? "item" : "items"}</p>
    <div className="audio-photo-grid">
      {visible.map(item => <label key={item.id} className={`audio-photo-choice ${selected.includes(item.id) ? "selected" : ""}`}>
        <input type="checkbox" disabled={disabled} checked={selected.includes(item.id)} onChange={event => onChange(event.target.checked ? [...selected, item.id] : selected.filter(id => id !== item.id))} />
        <ArchiveImage src={item.image} alt="" imageSet={item.imageSet} variant="small" autoPrepare={false} />
        <span>{item.title}<small>{item.date} · {item.place}</small></span>
      </label>)}
    </div>
    {!visible.length && <p>No matching photos or items.</p>}
    {!!selected.filter(id => !candidates.some(item => item.id === id)).length && <p className="help-line">Existing links not shown here are kept unchanged.</p>}
  </section>;
}
