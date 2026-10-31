"use client";
import { useState } from "react";
import { Check, ArrowLeft, ArrowRight } from "lucide-react";
import { transcriptionPages } from "@/lib/data";
import { useWorkspace } from "./workspace-provider";
import { can } from "@/lib/permissions";
import { ArchiveImage } from "./ui";
export const exampleLetterFiles = [
  { url: "/images/letter.jpg", label: "Page 1" },
  { url: "/images/letter-page-2.jpg", label: "Page 2" },
  { url: "/images/letter-page-3.jpg", label: "Outer sheet" },
];
export function TranscriptionReview({
  itemId,
  files = exampleLetterFiles,
}: {
  itemId: string;
  files?: { url: string; label: string }[];
}) {
  const workspace = useWorkspace();
  const [page, setPage] = useState(0);
  const [mode, setMode] = useState<"raw" | "reviewed">("raw");
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState("");
  const [saved, setSaved] = useState(false);
  const key = `${itemId}:page:${page}`;
  const raw = transcriptionPages[page % transcriptionPages.length];
  const reviewed = workspace.reviewedText[key];
  const allowed = can(workspace.role, "editor");
  function switchPage(next: number) {
    setPage(next);
    setEditing(false);
    setSaved(false);
  }
  return (
    <section className="transcription-review">
      <div className="review-heading">
        <div>
          <p className="eyebrow">A CLOSER READING</p>
          <h2>The source. The words.</h2>
        </div>
        <span
          className={`status-tag ${reviewed !== undefined ? "confirmed" : ""}`}
        >
          {reviewed !== undefined
            ? "Reviewed in this session"
            : "Needs human review"}
        </span>
      </div>
      <p className="demo-note">
        Review preview · fictional transcription, not a reading of these images.
        Confidence unavailable. The raw machine sample stays unchanged when you
        save a correction.
      </p>
      <div className="review-page-controls">
        <button
          className="subtle-button"
          disabled={page === 0}
          onClick={() => switchPage(page - 1)}
        >
          <ArrowLeft size={16} />
          Previous
        </button>
        <span>
          {files[page]?.label} · {page + 1} of {files.length}
        </span>
        <button
          className="subtle-button"
          disabled={page === files.length - 1}
          onClick={() => switchPage(page + 1)}
        >
          Next
          <ArrowRight size={16} />
        </button>
      </div>
      <div className="review-comparison">
        <div>
          <div className="review-column-label">
            <span className="eyebrow">ORIGINAL DOCUMENT</span>
            <span>Immutable source</span>
          </div>
          <ArchiveImage
            src={files[page].url}
            alt={`Original source: ${files[page].label}`}
            className="review-source"
          />
        </div>
        <div className="review-text-column">
          <div className="segmented" aria-label="Transcription version">
            <button
              className={mode === "raw" ? "selected" : ""}
              aria-pressed={mode === "raw"}
              onClick={() => setMode("raw")}
            >
              Raw AI transcription
            </button>
            <button
              className={mode === "reviewed" ? "selected" : ""}
              aria-pressed={mode === "reviewed"}
              onClick={() => setMode("reviewed")}
            >
              Reviewed transcription
            </button>
          </div>
          <div className="transcription-provenance">
            <span>Provider / model: illustrative sample</span>
            <span>Processing date: demo only · confidence: unavailable</span>
          </div>
          {editing ? (
            <label className="field">
              <span>Correct transcription · {files[page].label}</span>
              <textarea
                className="review-editor"
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                maxLength={20000}
              />
            </label>
          ) : (
            <div className="review-words">
              {mode === "raw"
                ? raw
                : (reviewed ??
                  "No reviewed transcription yet. An editor can compare the source and correct the raw AI text.")}
            </div>
          )}
          {allowed ? (
            <div className="small-actions">
              {editing ? (
                <>
                  <button
                    onClick={() => {
                      workspace.saveReview(key, draft);
                      if (
                        files.every(
                          (_, i) =>
                            i === page ||
                            workspace.reviewedText[`${itemId}:page:${i}`] !==
                              undefined,
                        )
                      )
                        workspace.finishReview(itemId);
                      setEditing(false);
                      setMode("reviewed");
                      setSaved(true);
                    }}
                  >
                    <Check
                      size={14}
                      style={{ display: "inline", marginRight: 8 }}
                    />
                    Save reviewed transcription
                  </button>
                  <button onClick={() => setEditing(false)}>Cancel</button>
                </>
              ) : (
                <button
                  onClick={() => {
                    setDraft(reviewed ?? raw);
                    setEditing(true);
                  }}
                >
                  Correct transcription
                </button>
              )}
            </div>
          ) : (
            <p className="notice">
              Editor or Admin access is required to save a reviewed
              transcription.
            </p>
          )}
          {saved && (
            <p className="help-line" role="status">
              Reviewed text saved in this session. Raw AI output and source
              files are unchanged.
            </p>
          )}
        </div>
      </div>
    </section>
  );
}
