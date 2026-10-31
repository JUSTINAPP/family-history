"use client";
import { useState } from "react";
import Link from "next/link";
import { ArrowUpRight, RotateCcw } from "lucide-react";
import { useWorkspace } from "../workspace-provider";
import { processingStages } from "@/lib/demo-workspace";
import { TranscriptionReview } from "../transcription-review";
export function Processing() {
  const workspace = useWorkspace();
  const [filter, setFilter] = useState("all");
  const [review, setReview] = useState(false);
  const rows = [
    ...workspace.captures.map((c) => ({
      id: c.id,
      title: c.title,
      kind: c.kind,
      status: c.jobStatus,
      stage: processingStages(c.kind)[c.jobStep],
      href: `/add/saved/${c.id}`,
      error: undefined,
    })),
    ...workspace.jobs,
  ];
  return (
    <>
      <div className="admin-page-heading">
        <div>
          <p className="eyebrow">THE WORK BEHIND THE COLLECTION</p>
          <h1>Processing.</h1>
          <p>Originals first. Everything else can follow.</p>
        </div>
      </div>
      <div className="processing-totals">
        <div>
          <strong>23</strong>
          <span>photographs complete · demo batch</span>
        </div>
        <div>
          <strong>4</strong>
          <span>letters reading · demo batch</span>
        </div>
        <div>
          <strong>
            {rows.filter((r) => r.status === "needs_review").length}
          </strong>
          <span>items need review</span>
        </div>
        <div>
          <strong>{rows.filter((r) => r.status === "failed").length}</strong>
          <span>processing errors</span>
        </div>
      </div>
      <div className="filter-tabs" aria-label="Processing status">
        {[
          "all",
          "queued",
          "processing",
          "needs_review",
          "complete",
          "failed",
        ].map((s) => (
          <button
            className={filter === s ? "selected" : ""}
            key={s}
            aria-pressed={filter === s}
            onClick={() => setFilter(s)}
          >
            {s === "all"
              ? "All"
              : s === "needs_review"
                ? "Needs review"
                : s[0].toUpperCase() + s.slice(1)}
          </button>
        ))}
      </div>
      <div className="job-list">
        {rows
          .filter((r) => filter === "all" || r.status === filter)
          .map((row) => (
            <article className="job-row" key={row.id}>
              <div>
                <p className="eyebrow">{row.kind}</p>
                <h2>{row.title}</h2>
                <p>{row.stage}</p>
                {row.error && <p className="job-error">{row.error}</p>}
              </div>
              <span
                className={`status-tag ${row.status === "failed" ? "uncertain" : row.status === "complete" ? "confirmed" : ""}`}
              >
                {row.status.replace("_", " ")}
              </span>
              <div>
                {row.status === "failed" ? (
                  <button
                    className="subtle-button"
                    aria-label={`Retry ${row.title}`}
                    onClick={() => workspace.retryJob(row.id)}
                  >
                    <RotateCcw size={14} />
                    Retry
                  </button>
                ) : row.id === "f0000000-0000-4000-8000-000000000001" ? (
                  <button
                    className="subtle-button"
                    onClick={() => setReview(!review)}
                  >
                    {review ? "Close review" : "Review transcription"}
                    <ArrowUpRight size={15} />
                  </button>
                ) : (
                  <Link className="subtle-button" href={row.href}>
                    {row.status === "needs_review"
                      ? "Inspect item"
                      : "View item"}
                    <ArrowUpRight size={15} />
                  </Link>
                )}
              </div>
            </article>
          ))}
      </div>
      {rows.filter((r) => filter === "all" || r.status === filter).length ===
        0 && <p className="notice">No items in this state.</p>}
      {review && (
        <TranscriptionReview itemId="f0000000-0000-4000-8000-000000000001" />
      )}
      <p className="demo-note">
        Processing is simulated. Capture jobs progress in the background during
        this session; the initial batches are representative examples. A failed
        derivative never removes an original. No transcription or metadata
        service is connected.
      </p>
    </>
  );
}
