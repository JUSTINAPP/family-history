"use client";
import Link from "next/link";
import { useRef, useState } from "react";
import type { ArchiveItem, Person, MemberRole } from "@/lib/types";
import type { ArchivePlace, ItemPlace } from "@/lib/places";
import type { Identification } from "@/lib/identifications";
import { needsInformation, type FamilyComment } from "@/lib/conversation";
import { can } from "@/lib/permissions";
import { ArchiveImage } from "../archive-image";
import { IdentificationForm } from "./identification-form";
import { PlacePicker } from "./place-picker";
import { QuickField } from "./quick-field";
import { FamilyConversation } from "./family-conversation";
export function QuickCatalogue({archiveId, items, people, places, placeLinks, identifications, comments,
  role, profileId, names, editableIds, page, total, needsOnly}: {
  archiveId: string; items: ArchiveItem[]; people: Person[]; places: ArchivePlace[]; placeLinks: ItemPlace[];
  identifications: Identification[]; comments: FamilyComment[]; role: MemberRole; profileId: string;
  names: Record<string,string>; editableIds: string[]; page: number; total: number; needsOnly: boolean;
}) {
  const [index, setIndex] = useState(0);
  const photo = useRef<HTMLDivElement>(null);
  function choose(n: number) {
    setIndex(n);
    photo.current?.scrollIntoView({block: "start"});
  }
  const item = items[Math.min(index, items.length-1)];
  const base = `/quick-catalogue?archive=${archiveId}${needsOnly ? "&needs=1" : ""}`;
  const nextNeeding = items.findIndex((i,n) => n > index && needsInformation(i));
  return <div className="quick-catalogue">
    <div className="section-top baseline"><div><p className="eyebrow">A LITTLE OF WHAT YOU KNOW</p><h1>Quick catalogue</h1></div><Link prefetch={false} className="text-link" href={`/explore?archive=${archiveId}`}>Back to Explore ↗</Link></div>
    <p>Recognise someone, add a date or place, leave a comment. Each saves on its own.</p>
    {!item ? <p className="notice">{needsOnly ? "No photographs currently need these details." : "No photographs here yet."}</p> : <>
      <nav className="quick-navigation" aria-label="Photograph navigation">
        {index ? <button className="subtle-button" onClick={() => choose(index-1)}>Previous</button>
          : page > 1 ? <Link prefetch={false} href={`${base}&page=${page-1}`}>Previous</Link> : <button disabled>Previous</button>}
        <span aria-live="polite">{(page-1)*12+Math.min(index,items.length-1)+1} of {total}</span>
        {index < items.length-1 ? <button className="subtle-button" onClick={() => choose(index+1)}>Next</button>
          : page*12 < total ? <Link prefetch={false} href={`${base}&page=${page+1}`}>Next</Link> : <button disabled>Next</button>}
        {nextNeeding >= 0 ? <button className="subtle-button" onClick={() => choose(nextNeeding)}>Next needing information</button>
          : <Link prefetch={false} href={`/quick-catalogue?archive=${archiveId}&needs=1`}>Find more needing information ↗</Link>}
      </nav>
      <div ref={photo} className="quick-photo-layout" key={item.id}>
        <section className="quick-photo">
          <ArchiveImage src={item.image} imageSet={item.imageSet} variant="small" autoPrepare={false} priority alt={item.title} />
          <h2>{item.title}</h2><Link prefetch={false} className="text-link" href={item.href!}>Open full record ↗</Link>
        </section>
        <section className="quick-context" aria-label="Quick photograph details">
          <IdentificationForm archiveId={archiveId} itemId={item.id} people={people}
            identifications={identifications.filter(i => i.item_id === item.id)} role={role} profileId={profileId} canCreate={editableIds.includes(item.id)} simple />
          <QuickField archiveId={archiveId} itemId={item.id} field="date" value={item.date === "Date not yet known" ? "" : item.date} precision={item.datePrecision} editable={editableIds.includes(item.id)} />
          <PlacePicker archiveId={archiveId} itemId={item.id} places={places} links={placeLinks.filter(l => l.item_id === item.id)}
            reportedText={item.place === "Place not yet known" ? "" : item.place} editable={editableIds.includes(item.id)} editor={can(role,"editor")} profileId={profileId} simple />
          <details><summary>Add or edit a caption</summary><QuickField archiveId={archiveId} itemId={item.id} field="caption" value={item.rawTitle || ""} editable={editableIds.includes(item.id)} /></details>
          <FamilyConversation archiveId={archiveId} itemId={item.id} comments={comments.filter(c => c.item_id === item.id)} profileId={profileId} names={names} canComment={can(role,"commenter") && item.ingestionStatus === "ready"} editor={can(role,"editor")} />
        </section>
      </div>
      <nav className="quick-photo-strip" aria-label="Photographs in this group">{items.map((photo,n) => <button key={photo.id} aria-current={n===index ? "true" : undefined} aria-label={`Choose photograph ${n+1}: ${photo.title}`} onClick={() => choose(n)}>
        <ArchiveImage src={photo.image} imageSet={photo.imageSet} variant="small" autoPrepare={false} alt="" />
      </button>)}</nav>
    </>}
  </div>;
}
