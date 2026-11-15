"use client";
import { useState } from "react";
import Link from "next/link";
import { ArchiveImage, TextLink } from "./ui";
import {PeopleTools} from "./live/people-tools";
import {Search} from "lucide-react";
import type { Person } from "@/lib/types";
import type { PersonMaterial } from "@/lib/people-material";
import { PersonMaterialStack } from "./person-material-stack";
type OverviewPerson = Pick<
  Person,
  "id" | "slug" | "name" | "lifespan" | "category"
> &
  Partial<Pick<Person, "image" | "position">>;
export function PeopleOverview({
  people,
  materials = {},
  archiveId,
  unavailable = false,
  mode = "live",
}: {
  people: OverviewPerson[];
  materials?: Record<string, PersonMaterial>;
  archiveId?: string;
  unavailable?: boolean;
  mode?: "live" | "demo";
}) {
  const [filter, setFilter] = useState("All");
  const [query,setQuery]=useState("");
  return (
    <div className="page-shell directory-page">
      <div className="directory-heading"><h1>People</h1><div className="directory-actions"><TextLink href="/tree">Family connections</TextLink>{mode==="live"&&<PeopleTools compact/>}</div></div>
      <label className="feed-search"><Search size={20} aria-hidden="true"/><input type="search" aria-label="Search people" placeholder="Find someone in the archive" value={query} onChange={e=>setQuery(e.target.value)}/></label>
      <div className="feed-filters" aria-label="People categories">
        {["All", "Family", "Friends", "Other", "Unidentified"].map((f) => (
          <button
            className={filter === f ? "selected" : ""}
            aria-pressed={filter === f}
            key={f}
            onClick={() => setFilter(f)}
          >
            {f}
          </button>
        ))}
      </div>
      {unavailable && (
        <p className="notice">
          Some linked material could not load. Reload to see the complete
          collection.
        </p>
      )}
      <div
        className={`people-grid ${mode === "live" ? "archival-people-grid" : ""}`}
      >
        {people
          .filter((p) => (filter === "All" || p.category === filter) && p.name.toLowerCase().includes(query.toLowerCase().trim()))
          .sort((a,b)=>Number(!!materials[b.id]?.items.length)-Number(!!materials[a.id]?.items.length))
          .map((p) => (
            <Link
              prefetch={false}
              key={p.id}
              href={`/people/${p.slug}${archiveId ? `?archive=${archiveId}` : ""}`}
              className={`person-card ${mode==="live"&&!materials[p.id]?.items.length ? "directory-card-empty" : ""}`}
            >
              {mode === "live" ? (
                <PersonMaterialStack
                  items={materials[p.id]?.items || []}
                  count={materials[p.id]?.count || 0}
                  name={p.name}
                />
              ) : (
                <ArchiveImage
                  src={p.image || "/images/empty-archive.svg"}
                  alt={`${p.name} — illustrative archival image`}
                  position={p.position}
                />
              )}
              <h2>{p.name}</h2>
              <div className="person-meta">
                {p.lifespan && !/not yet known/i.test(p.lifespan) && <span>{p.lifespan}</span>}
                <span>{p.category}</span>
              </div>
              {mode === "live" && (
                <p className="person-material-count">
                  {materials[p.id]?.count || 0} linked{" "}
                  {(materials[p.id]?.count || 0) === 1 ? "item" : "items"}
                </p>
              )}
            </Link>
          ))}
      </div>
      {mode === "demo" && (
        <p className="demo-note">
          Portraits illustrate the design; they do not identify the people in
          the historical photographs.
        </p>
      )}
      {!people.length && (
        <p className="notice">
          No people have been catalogued yet. A person record does not create a
          member account.
        </p>
      )}
    </div>
  );
}
