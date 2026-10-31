"use client";
import { useState, useRef } from "react";
import Link from "next/link";
import { Expand, X, ArrowUpRight } from "lucide-react";
import { useWorkspace } from "./workspace-provider";
import { can } from "@/lib/permissions";
import { items, people, transcriptionPages } from "@/lib/data";
import type { ArchiveItem } from "@/lib/types";
import { ArchiveImage, Eyebrow, ItemCard } from "./ui";
const pageImages = [
  "/images/letter.jpg",
  "/images/letter-page-2.jpg",
  "/images/letter-page-3.jpg",
];
export function ItemDetail({ item }: { item: ArchiveItem }) {
  const workspace = useWorkspace();
  const letter = item.kind === "Letter";
  const [page, setPage] = useState(0);
  const [tab, setTab] = useState("Transcription");
  const [mode, setMode] = useState("Transcribed");
  const [editing, setEditing] = useState(false);
  const [reviewed, setReviewed] = useState<Record<number, string>>({});
  const [draft, setDraft] = useState("");
  const [comment, setComment] = useState("");
  const [comments, setComments] = useState<string[]>([]);
  const [saved, setSaved] = useState(false);
  const dialog = useRef<HTMLDialogElement>(null);
  const image = letter ? pageImages[page] : item.image;
  const currentText = reviewed[page] ?? transcriptionPages[page];
  function changePage(n: number) {
    setPage(n);
    setEditing(false);
    setSaved(false);
  }
  return (
    <>
      <div className="page-shell">
        <div className="breadcrumb">
          <Link href="/explore">The archive</Link>
          <span>/</span>
          <Link href={`/explore?type=${item.kind}`}>{item.kind}s</Link>
          <span>/</span>
          <span>{item.title}</span>
        </div>
        <div className="item-layout">
          <section
            className="item-source"
            aria-label="Original source material"
          >
            <div className="document-viewer">
              <ArchiveImage
                src={image}
                alt={
                  letter
                    ? `Letter page ${page + 1}. ${"Public-domain illustrative handwritten source."}`
                    : item.alt
                }
                priority
              />
              <div className="document-controls">
                <span>
                  {letter
                    ? `ORIGINAL · PAGE ${page + 1} OF 3`
                    : "ORIGINAL SOURCE · DEMO IMAGE"}
                </span>
                <button onClick={() => dialog.current?.showModal()}>
                  <Expand size={14} />
                  View larger
                </button>
              </div>
            </div>
            {letter && (
              <div className="page-thumbnails" aria-label="Letter pages">
                {pageImages.map((src, i) => (
                  <button
                    className={page === i ? "selected" : ""}
                    key={src}
                    onClick={() => changePage(i)}
                    aria-label={`View page ${i + 1}`}
                    aria-pressed={page === i}
                  >
                    <ArchiveImage src={src} alt="" />
                    <span>Page {i + 1}</span>
                  </button>
                ))}
              </div>
            )}
          </section>
          <aside className="item-info">
            <Eyebrow>
              {item.kind} / OFA–{item.id.slice(-3)}
            </Eyebrow>
            <h1>{item.title}</h1>
            <span className="pill">
              {item.date}{" "}
              {item.certainty === "uncertain" ? "· date uncertain" : ""}
            </span>
            <p className="prose">{item.notes}</p>
            <dl className="metadata-grid">
              <div>
                <dt>Date</dt>
                <dd>
                  {item.date}
                  <br />
                  <small>Reported by family · unverified</small>
                </dd>
              </div>
              <div>
                <dt>Location</dt>
                <dd>
                  <Link
                    href={`/explore?place=${encodeURIComponent(item.place)}`}
                  >
                    {item.place}
                  </Link>
                </dd>
              </div>
              {letter && (
                <>
                  <div>
                    <dt>Author</dt>
                    <dd>
                      <Link href="/people/margaret-wilson">
                        Margaret Wilson
                      </Link>
                    </dd>
                  </div>
                  <div>
                    <dt>Recipient</dt>
                    <dd>
                      <Link href="/people/janice-allen">Janice Allen</Link>
                    </dd>
                  </div>
                </>
              )}
              <div>
                <dt>{letter ? "People mentioned" : "People"}</dt>
                <dd>
                  {item.people.map((slug) => (
                    <div key={slug}>
                      <Link href={`/people/${slug}`}>
                        {people.find((p) => p.slug === slug)?.name}
                      </Link>
                    </div>
                  ))}
                </dd>
              </div>
              <div>
                <dt>Places mentioned</dt>
                <dd>
                  <Link
                    href={`/explore?place=${encodeURIComponent(item.place)}`}
                  >
                    {item.place}
                  </Link>
                  {letter && (
                    <div>
                      Blue Mountains <small>(suggested)</small>
                    </div>
                  )}
                </dd>
              </div>
              <div>
                <dt>Contributed by</dt>
                <dd>
                  Jonas Allen
                  <br />
                  <small>Demo contribution</small>
                </dd>
              </div>
              <div>
                <dt>Collection</dt>
                <dd>
                  <Link
                    href={`/explore?q=${encodeURIComponent(item.collection)}`}
                  >
                    {item.collection}
                  </Link>
                </dd>
              </div>
              <div style={{ gridColumn: "1/-1" }}>
                <dt>Tags</dt>
                <dd className="tag-list">
                  {item.tags.map((t) => (
                    <Link
                      key={t}
                      href={`/explore?q=${encodeURIComponent(t)}`}
                      className="pill"
                    >
                      {t}
                    </Link>
                  ))}
                </dd>
              </div>
            </dl>
            <p className="demo-note">
              Illustrative record. Names, dates and the sample transcription do
              not describe the pictured historical source.{" "}
              <Link href="/about" style={{ textDecoration: "underline" }}>
                About the material ↗
              </Link>
            </p>
          </aside>
        </div>
        <section>
          <div
            className="filter-tabs item-tabs"
            role="tablist"
            aria-label="Archive item sections"
            onKeyDown={(e) => {
              const buttons = Array.from(
                e.currentTarget.querySelectorAll<HTMLButtonElement>("button"),
              );
              const index = buttons.indexOf(
                document.activeElement as HTMLButtonElement,
              );
              let next = index;
              if (e.key === "ArrowRight") next = (index + 1) % buttons.length;
              else if (e.key === "ArrowLeft")
                next = (index - 1 + buttons.length) % buttons.length;
              else if (e.key === "Home") next = 0;
              else if (e.key === "End") next = buttons.length - 1;
              else return;
              e.preventDefault();
              buttons[next].focus();
              buttons[next].click();
            }}
          >
            {[
              ...(letter ? ["Transcription"] : []),
              "Details",
              "Related items",
              "Comments",
            ].map((t) => (
              <button
                key={t}
                role="tab"
                tabIndex={
                  (tab === "Transcription" && !letter ? "Details" : tab) === t
                    ? 0
                    : -1
                }
                id={`tab-${t.replace(" ", "-")}`}
                aria-controls="item-panel"
                aria-selected={
                  (tab === "Transcription" && !letter ? "Details" : tab) === t
                }
                className={
                  (tab === "Transcription" && !letter ? "Details" : tab) === t
                    ? "selected"
                    : ""
                }
                onClick={() => setTab(t)}
              >
                {t}
                {t === "Comments" && comments.length > 0
                  ? ` (${comments.length})`
                  : ""}
              </button>
            ))}
          </div>
          <div
            id="item-panel"
            role="tabpanel"
            aria-labelledby={`tab-${(tab === "Transcription" && !letter ? "Details" : tab).replace(" ", "-")}`}
            tabIndex={0}
          >
            {letter && tab === "Transcription" && (
              <>
                <div className="transcription-head">
                  <div className="segmented" aria-label="Transcription view">
                    {["Original", "Transcribed"].map((v) => (
                      <button
                        key={v}
                        className={mode === v ? "selected" : ""}
                        aria-pressed={mode === v}
                        onClick={() => setMode(v)}
                      >
                        {v}
                      </button>
                    ))}
                  </div>
                  <span className="pill">
                    {reviewed[page] !== undefined
                      ? "Human-reviewed demo text"
                      : "AI transcription · sample"}{" "}
                    · Page {page + 1}
                  </span>
                </div>
                {mode === "Original" ? (
                  <div style={{ maxWidth: 550 }}>
                    <ArchiveImage
                      src={image}
                      alt={`Original illustrative letter page ${page + 1}`}
                      className="transcription-original"
                    />
                    <p className="help-line">
                      The original remains the source of truth.
                    </p>
                  </div>
                ) : (
                  <>
                    <div className="review-note">
                      <strong>
                        {reviewed[page] !== undefined
                          ? "Reviewed in this session"
                          : "AI transcription · awaiting review"}
                      </strong>
                      {reviewed[page] !== undefined
                        ? "Your correction is kept in memory for this demo. The raw sample and original image are unchanged."
                        : "Illustrative text, not an actual AI reading of this image. In the connected archive, uncertain words will be flagged for human review. Confidence is unavailable for this sample."}
                    </div>
                    {editing ? (
                      <>
                        <label
                          htmlFor="transcription-edit"
                          className="field-label"
                        >
                          Correct the transcription for page {page + 1}
                        </label>
                        <textarea
                          id="transcription-edit"
                          className="transcription-editor"
                          value={draft}
                          onChange={(e) => setDraft(e.target.value)}
                        />
                        <div className="small-actions">
                          <button
                            onClick={() => {
                              setReviewed({ ...reviewed, [page]: draft });
                              setEditing(false);
                              setSaved(true);
                            }}
                          >
                            Save reviewed text in demo
                          </button>
                          <button onClick={() => setEditing(false)}>
                            Cancel
                          </button>
                        </div>
                      </>
                    ) : (
                      <>
                        <div className="transcription">{currentText}</div>
                        <Link
                          className="text-link"
                          href={`/archive/${item.slug}/review`}
                        >
                          Compare source &amp; review transcription
                          <ArrowUpRight size={15} />
                        </Link>
                        <div className="small-actions">
                          <button
                            onClick={() => {
                              if (can(workspace.role, "editor")) {
                                setDraft(currentText);
                                setEditing(true);
                              }
                            }}
                          >
                            {can(workspace.role, "editor")
                              ? "Suggest a correction"
                              : "Editor access required to correct"}
                          </button>
                          {reviewed[page] !== undefined && (
                            <button
                              onClick={() => {
                                const next = { ...reviewed };
                                delete next[page];
                                setReviewed(next);
                                setSaved(false);
                              }}
                            >
                              Show raw sample again
                            </button>
                          )}
                        </div>
                      </>
                    )}
                    {saved && (
                      <p className="help-line" role="status">
                        Reviewed text saved for this session. Historical
                        metadata has not changed.
                      </p>
                    )}
                  </>
                )}
              </>
            )}
            {(tab === "Details" || (!letter && tab === "Transcription")) && (
              <div
                className="two-col-section"
                style={{ borderTop: 0, paddingTop: 10 }}
              >
                <h2>The record behind it.</h2>
                <div>
                  <dl className="metadata-grid">
                    <div>
                      <dt>Provenance</dt>
                      <dd>
                        Reported by Jonas Allen: found in a family box, with no
                        original inventory. Illustrative provenance, awaiting
                        review.
                      </dd>
                    </div>
                    <div>
                      <dt>Certainty</dt>
                      <dd>
                        {item.certainty === "uncertain"
                          ? "Uncertain — needs identification"
                          : "Reported by a family member"}
                        <br />
                        No demo metadata is verified.
                      </dd>
                    </div>
                    <div>
                      <dt>Original file</dt>
                      <dd>
                        {letter
                          ? "3 illustrative scans from one public-domain letter record."
                          : "Local illustrative source image."}
                        <br />
                        Original bytes would be preserved unchanged in private
                        storage.
                      </dd>
                    </div>
                    <div>
                      <dt>Derived assets</dt>
                      <dd>
                        Display image, thumbnail and processing source will each
                        link to the original. No live optimisation pipeline is
                        connected.
                      </dd>
                    </div>
                    <div>
                      <dt>Record ID</dt>
                      <dd style={{ overflowWrap: "anywhere" }}>{item.id}</dd>
                    </div>
                    <div>
                      <dt>AI processing</dt>
                      <dd>
                        Demo only · suggestions require review. AI cannot
                        silently change this record.
                      </dd>
                    </div>
                  </dl>
                </div>
              </div>
            )}
            {tab === "Related items" && (
              <div className="recent-grid">
                {items
                  .filter(
                    (i) =>
                      i.id !== item.id &&
                      (i.people.some((p) => item.people.includes(p)) ||
                        i.collection === item.collection),
                  )
                  .slice(0, 4)
                  .map((i, n) => (
                    <ItemCard key={i.id} item={i} index={n} />
                  ))}
              </div>
            )}
            {tab === "Comments" && (
              <div style={{ maxWidth: 680 }}>
                <h2 style={{ fontSize: 36 }}>What do you remember?</h2>
                <p className="help-line">
                  A name, a detail, a memory. Demo comments stay in this
                  session.
                </p>
                <form
                  className="comment-form"
                  onSubmit={(e) => {
                    e.preventDefault();
                    if (comment.trim() && can(workspace.role, "commenter")) {
                      setComments([...comments, comment.trim()]);
                      setComment("");
                    }
                  }}
                >
                  <label className="sr-only" htmlFor="comment">
                    Your memory or comment
                  </label>
                  <textarea
                    id="comment"
                    value={comment}
                    onChange={(e) => setComment(e.target.value)}
                    placeholder="Add a little of what you know…"
                    maxLength={5000}
                    required
                  />
                  <button
                    className="button"
                    type="submit"
                    disabled={!can(workspace.role, "commenter")}
                  >
                    Add comment
                    <ArrowUpRight size={16} />
                  </button>
                </form>
                <div aria-live="polite">
                  {comments.map((c, i) => (
                    <article className="comment" key={i}>
                      <div className="comment-meta">
                        <strong>Jonas Allen</strong>
                        <span>Just now · demo</span>
                      </div>
                      <p>{c}</p>
                    </article>
                  ))}
                </div>
                {!comments.length && (
                  <p className="help-line" style={{ marginTop: 25 }}>
                    No memories shared here yet.
                  </p>
                )}
              </div>
            )}
          </div>
        </section>
      </div>
      <dialog
        className="full-screen-dialog"
        ref={dialog}
        onClick={(e) => {
          if (e.target === e.currentTarget) dialog.current?.close();
        }}
      >
        <button onClick={() => dialog.current?.close()} autoFocus>
          Close <X size={18} />
        </button>
        <ArchiveImage src={image} alt={item.alt} />
      </dialog>
    </>
  );
}
