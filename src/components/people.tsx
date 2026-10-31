"use client";
import { useState } from "react";
import Link from "next/link";
import { useCatalogue } from "./catalogue";
import { useWorkspace } from "./workspace-provider";
import { ArchiveImage, PageIntro, TextLink } from "./ui";
export function People() {
  const { people } = useCatalogue();
  const { mode } = useWorkspace();
  const [filter, setFilter] = useState("All");
  return (
    <div className="page-shell">
      <PageIntro
        eyebrow="THE PEOPLE IN OUR STORIES"
        title="A familiar face."
        description="Family, friends, and people we’re still getting to know. Every person has a place here."
      >
        <TextLink href="/tree">See family connections</TextLink>
      </PageIntro>
      <div className="filter-tabs" aria-label="People categories">
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
      <div className="people-grid">
        {people
          .filter((p) => filter === "All" || p.category === filter)
          .map((p) => (
            <Link key={p.id} href={`/people/${p.slug}`} className="person-card">
              <ArchiveImage
                src={p.image}
                alt={`${p.name} — illustrative archival image`}
                position={p.position}
              />
              <h2>{p.name}</h2>
              <div className="person-meta">
                <span>{p.lifespan}</span>
                <span>{p.category}</span>
              </div>
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
