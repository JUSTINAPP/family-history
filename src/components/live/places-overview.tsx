"use client";
import Link from "next/link";
import {useState} from "react";
import {Search} from "lucide-react";
import {PlaceEditor} from "./place-editor";
import { PersonMaterialStack } from "../person-material-stack";
import { placeSubtitle, type ArchivePlace } from "@/lib/places";
import type { PersonMaterial } from "@/lib/people-material";
export function PlacesOverview({
  places,
  materials,
  archiveId, editable=false,
}: {
  places: ArchivePlace[];
  materials: Record<string, PersonMaterial>;
  archiveId: string; editable?:boolean;
}) {
  const [query,setQuery]=useState("");
  return (
    <div className="page-shell directory-page">
      <div className="directory-heading"><h1>Places</h1>{editable&&<PlaceEditor archiveId={archiveId}/>}</div>
      <label className="feed-search"><Search size={20} aria-hidden="true"/><input type="search" aria-label="Search places" placeholder="Find a place in the archive" value={query} onChange={e=>setQuery(e.target.value)}/></label>
      <div className="people-grid archival-people-grid places-archive-grid">
        {places.filter(place=>place.name.toLowerCase().includes(query.toLowerCase().trim())).sort((a,b)=>Number(!!materials[b.id]?.items.length)-Number(!!materials[a.id]?.items.length)).map((place) => (
          <Link
            prefetch={false}
            key={place.id}
            href={`/places/${place.id}?archive=${archiveId}`}
            className={`person-card place-archive-card ${!materials[place.id]?.items.length ? "directory-card-empty" : ""}`}
          >
            <PersonMaterialStack
              items={materials[place.id]?.items || []}
              count={materials[place.id]?.count || 0}
              name={place.name}
            />
            <h2>{place.name}</h2>
            <p className="help-line">{placeSubtitle(place)}</p>
            <p className="person-material-count">
              {materials[place.id]?.count || 0} linked{" "}
              {(materials[place.id]?.count || 0) === 1 ? "item" : "items"}
            </p>
          </Link>
        ))}
      </div>
      {!places.length && (
        <p className="notice">
          No Places have been catalogued in this archive yet. A name is enough
          to begin.
        </p>
      )}
    </div>
  );
}
