"use client";
import { useState, useRef, useEffect } from "react";
import { useSearchParams } from "next/navigation";
import { Search, X, ArrowUpRight } from "lucide-react";
import Link from "next/link";
import { transcriptionPages } from "@/lib/data";
import { useWorkspace } from "./workspace-provider";
import { useCatalogue } from "./catalogue";
import { PageIntro, ItemCard } from "./ui";
const kinds = [
  "All",
  "Photographs",
  "Letters",
  "Objects",
  "Documents",
  "Audio",
];
const typeMap: Record<string, string> = {
  Audio: "Audio",
  Photographs: "Photograph",
  Letters: "Letter",
  Objects: "Object",
  Documents: "Document",
};
export function Explore() {
  const { items, people, places } = useCatalogue();
  const workspace = useWorkspace();
  const params = useSearchParams();
  const [q, setQ] = useState(params.get("q") || "");
  const [type, setType] = useState(params.get("type") || "All");
  const [person, setPerson] = useState(params.get("person") || "");
  const [date, setDate] = useState("");
  const [place, setPlace] = useState(params.get("place") || "");
  const [collection, setCollection] = useState("");
  const [unidentified, setUnidentified] = useState(params.has("unidentified"));
  const [family, setFamily] = useState("");
  const input = useRef<HTMLInputElement>(null);
  useEffect(() => {
    if (params.has("focus")) input.current?.focus();
  }, [params]);
  const filtered = items.filter((item) => {
    const names = item.people
      .map(
        (slug) =>
          people.find((p) => p.slug === slug || p.id === slug)?.name || "",
      )
      .join(" ");
    const placeNames = places
      .filter((p) => item.placeIds?.includes(p.slug))
      .map((p) => p.name)
      .join(" ");
    return (
      (!params.get("batch") || item.importBatchId === params.get("batch")) &&
      (type === "All" || item.kind === type) &&
      (!q ||
        `${item.title} ${item.reportedPeople || ""} ${item.notes} ${item.place} ${placeNames} ${item.date} ${item.collection} ${item.tags.join(" ")} ${names} ${workspace.mode === "live" ? item.reviewedText || "" : item.kind === "Letter" ? transcriptionPages.join(" ") : ""}`
          .toLowerCase()
          .includes(q.toLowerCase())) &&
      (!person || item.people.includes(person)) &&
      (!date || Math.floor((item.year || 0) / 10) * 10 === Number(date)) &&
      (!place ||
        (workspace.mode === "live"
          ? item.placeIds?.includes(place)
          : item.place === place)) &&
      (!collection || item.collection === collection) &&
      (!unidentified ||
        item.tags.includes("Unidentified") ||
        item.people.includes("unknown-at-the-picnic")) &&
      (!family ||
        item.people.some((p) =>
          family === "Allen" ? p.includes("allen") : p.includes("wilson"),
        ))
    );
  });
  function reset() {
    setQ("");
    setType("All");
    setPerson("");
    setDate("");
    setPlace("");
    setCollection("");
    setUnidentified(false);
    setFamily("");
  }
  const group = params.get("group");
  if (
    workspace.mode === "live" &&
    place &&
    workspace.resourceWarnings?.some((w) => w.startsWith("Place associations"))
  )
    return (
      <div className="page-shell">
        <PageIntro
          eyebrow="PLACES"
          title="Place associations could not load."
          description="Reload to see a complete list of linked material."
        />
        <Link href={`/explore?archive=${workspace.archive.id}`}>
          View all items
        </Link>
      </div>
    );
  if (
    workspace.mode === "live" &&
    person &&
    workspace.resourceWarnings?.some((w) => w.startsWith("Person associations"))
  )
    return (
      <div className="page-shell">
        <PageIntro
          eyebrow="PEOPLE"
          title="Person associations could not load."
          description="Reload to see a complete list of linked items."
        />
        <Link href={`/explore?archive=${workspace.archive.id}`}>
          View all items
        </Link>
      </div>
    );
  if (workspace.mode === "live" && workspace.catalogueAvailable === false)
    return (
      <div className="page-shell">
        <PageIntro
          eyebrow="YOUR ARCHIVE"
          title="The archive list could not load."
          description="Your saved items have not been removed. Retry to load the complete list."
        />
        <a className="button" href={`/explore?archive=${workspace.archive.id}`}>
          Retry View everything
        </a>
      </div>
    );

  return (
    <div className="page-shell explore-page">
      {params.get("state") === "archived" && (
        <p className="notice">
          Archived items · Editors can open, review and restore them. <Link href={`/explore?archive=${workspace.archive.id}`}>View active items ↗</Link>
        </p>
      )}
      {params.get("batch") && (
        <p className="notice">
          Showing photographs from this import.{" "}
          <a
            className="text-link"
            href={`/explore?archive=${workspace.archive.id}`}
          >
            View the whole archive ↗
          </a>
        </p>
      )}
      {workspace.resourceWarnings?.some((w) => w.startsWith("Some source")) && (
        <p className="notice">
          Some previews could not load. Items are still listed and can be
          opened.
        </p>
      )}
      <div className="explore-heading">
        <h1>Explore</h1>
        {workspace.mode === "live" && <Link prefetch={false} className="text-link" href={`/quick-catalogue?archive=${workspace.archive.id}`}>Quick catalogue ↗</Link>}
      </div>
      <div className="archive-controls">
        <div className="search-field">
          <Search size={20} />
          <input
            ref={input}
            aria-label="Search the archive"
            type="search"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search names, places or details"
          />
          {q && (
            <button aria-label="Clear search" onClick={() => setQ("")}>
              <X size={17} />
            </button>
          )}
        </div>
        <span className="search-count" aria-live="polite">
          {filtered.length} items to discover
        </span>
      </div>
      {group && (
        <div className="notice">
          <strong>Explore by {group}</strong>
          <p className="help-line">
            {group === "years"
              ? "Choose a decade to find moments from that time."
              : group === "families"
                ? "Follow connections to the Allen and Wilson families."
                : "Gathered material, connected by a common thread."}
          </p>
          {group === "families" && (
            <div className="small-actions">
              {["Allen", "Wilson"].map((f) => (
                <button
                  aria-pressed={family === f}
                  key={f}
                  onClick={() => setFamily(family === f ? "" : f)}
                >
                  {f} family {family === f ? "✓" : ""}
                </button>
              ))}
            </div>
          )}
        </div>
      )}
      <div className="filter-tabs" aria-label="Item type">
        {kinds.map((k) => (
          <button
            key={k}
            className={type === (typeMap[k] || k) ? "selected" : ""}
            aria-pressed={type === (typeMap[k] || k)}
            onClick={() => setType(typeMap[k] || k)}
          >
            {k}
          </button>
        ))}
      </div>
      <div className="filter-row">
        <div className="filter-selects">
          <label className="select-filter">
            <span className="sr-only">People</span>
            <select value={person} onChange={(e) => setPerson(e.target.value)}>
              <option value="">People</option>
              {people.map((p) => (
                <option
                  value={workspace.mode === "live" ? p.id : p.slug}
                  key={p.id}
                >
                  {p.name}
                </option>
              ))}
            </select>
          </label>
          <label className="select-filter">
            <span className="sr-only">Date</span>
            <select value={date} onChange={(e) => setDate(e.target.value)}>
              <option value="">Date</option>
              {[1920, 1930, 1950, 1960].map((y) => (
                <option key={y} value={y}>
                  {y}s
                </option>
              ))}
            </select>
          </label>
          <label className="select-filter">
            <span className="sr-only">Place</span>
            <select value={place} onChange={(e) => setPlace(e.target.value)}>
              <option value="">Place</option>
              {places.map((p) => (
                <option
                  key={p.slug}
                  value={workspace.mode === "live" ? p.slug : p.name}
                >
                  {p.name}
                </option>
              ))}
            </select>
          </label>
          <label className="select-filter">
            <span className="sr-only">Collection</span>
            <select
              value={collection}
              onChange={(e) => setCollection(e.target.value)}
            >
              <option value="">Collection</option>
              {[...new Set(items.map((i) => i.collection))].map((c) => (
                <option key={c}>{c}</option>
              ))}
            </select>
          </label>
          {unidentified && (
            <button
              className="select-filter"
              onClick={() => setUnidentified(false)}
            >
              Unidentified <X size={12} />
            </button>
          )}
        </div>
        <button className="reset-button" onClick={reset}>
          Clear filters
        </button>
      </div>
      {filtered.length ? (
        <div className={`masonry ${workspace.mode === "live" ? "conversation-grid" : ""}`}>
          {filtered.map((item, i) => (
            <ItemCard key={item.id} item={item} index={i} inlineConversation={workspace.mode === "live"} imageSizes={workspace.mode === "live"?"(max-width: 600px) 90vw, (max-width: 820px) 44vw, (max-width: 1100px) 29vw, (max-width: 1800px) 22vw, 385px":undefined} />
          ))}
        </div>
      ) : (
        <div className="empty-state">
          <h2>Still waiting to be found.</h2>
          <p>
            No items match these details. Try another word, or give the filters
            a little room.
          </p>
          <button className="button button-light" onClick={reset}>
            Show the whole collection
          </button>
        </div>
      )}
      <div className="home-divider" style={{ margin: "30px 0 0" }}>
        <span>You’ve reached the end of this little collection.</span>
        <Link href="/add" style={{ display: "flex", gap: 10 }}>
          Help it grow
          <ArrowUpRight size={15} />
        </Link>
      </div>
    </div>
  );
}
