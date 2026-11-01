"use client";
import Link from "next/link";
import { Check, ArrowUpRight, Download } from "lucide-react";
import { useWorkspace } from "./workspace-provider";
import { ArchiveImage, PageIntro } from "./ui";
import { processingStages } from "@/lib/demo-workspace";
import { downloadDraft } from "@/lib/capture";
export function SavedCapture({ id }: { id: string }) {
  const workspace = useWorkspace();
  const item = workspace.captures.find((i) => i.id === id);
  if (!item)
    return (
      <div className="page-shell">
        <PageIntro
          eyebrow="LOCAL SESSION"
          title="A fresh beginning."
          description="This capture is no longer in memory. Demo files clear when the page reloads; keep your original files and export details before leaving."
        />
        <Link className="text-link" href="/add">
          Capture something
          <ArrowUpRight size={16} />
        </Link>
      </div>
    );
  const phases = processingStages();
  return (
    <div className="page-shell saved-capture">
      <PageIntro
        eyebrow="SAVED IN THIS DEMO SESSION"
        title={item.title}
        description="The material, your memory, and any proposed details each keep their own place."
      >
        <Link className="button" href="/add">
          Capture the next item
          <ArrowUpRight size={17} />
        </Link>
      </PageIntro>
      <div className="background-status" role="status">
        <Check size={20} />
        <div>
          <strong>
            {item.jobStatus === "queued"
              ? "Queued for processing"
              : item.jobStatus === "processing"
                ? `${phases[item.jobStep]} · processing preview`
                : item.jobStatus === "needs_review"
                  ? "Transcription ready for review"
                  : "Processing preview complete"}
          </strong>
          <p>
            Originals preserved in this demo. You can keep capturing straight
            away.
          </p>
        </div>
        <Link href="/admin/processing">View processing ↗</Link>
      </div>
      <div className="saved-material-layout">
        <section>
          {item.files.map(file => <ArchiveImage key={file.id}
            src={file.url} alt={`Preserved local source ${file.originalName}`}
            className="saved-original" />)}
          <div className="saved-file-list">
            {item.files.map((file, i) => (
              <a key={file.id} href={file.url} download={file.originalName}>
                <span>
                  {String(i + 1).padStart(2, "0")} · {file.role} ·{" "}
                  {file.originalName}
                </span>
                <Download size={15} />
              </a>
            ))}
          </div>
          <p className="help-line">
            Downloads use your selected original bytes. No optimisation is
            applied to these files.
          </p>
        </section>
        <section className="saved-context">
          <p className="eyebrow">CONTRIBUTOR RECOLLECTION</p>
          <h2>The story as you told it.</h2>
          {item.recollection.originalText ? (
            <blockquote>{item.recollection.originalText}</blockquote>
          ) : !item.recollection.audioSource ? (
            <p className="prose">
              No recollection yet. Capturing the material is enough to begin.
            </p>
          ) : null}
          {item.recollection.audioSource && (
            <>
              <p className="eyebrow" style={{ marginTop: 25 }}>
                ORIGINAL AUDIO · DEMO EXAMPLE
              </p>
              <audio
                controls
                src={item.recollection.audioSource}
                aria-label="Preserved recollection audio"
              />
              <a
                className="subtle-button"
                href={item.recollection.audioSource}
                download
              >
                Download original example audio
                <Download size={14} />
              </a>
            </>
          )}
          {item.recollection.machineTranscript && (
            <details>
              <summary>Machine transcript · preserved raw text</summary>
              <p>{item.recollection.machineTranscript}</p>
            </details>
          )}
          {item.recollection.editedTranscript !== null && (
            <details open>
              <summary>Contributor-edited transcript</summary>
              <p>{item.recollection.editedTranscript}</p>
            </details>
          )}
          <p className="help-line">
            Jonas Allen (demo) ·{" "}
            {new Date(item.recollection.recordedAt).toLocaleString("en-AU", {
              timeZone: "Australia/Sydney",
            })}
            <br />
            Source: contributor recollection · unverified.
          </p>
          <div className="saved-quick">
            {Object.entries(item.quick)
              .filter(([k, v]) => v && k !== "precision")
              .map(([key, value]) => (
                <div key={key}>
                  <span>{key}</span>
                  <p>{value}</p>
                </div>
              ))}
          </div>
          {item.suggestions.length > 0 && (
            <>
              <p className="eyebrow" style={{ marginTop: 30 }}>
                INTERPRETATION · SEPARATE FROM THE RECORD
              </p>
              {item.suggestions.map((s) => (
                <div className="saved-suggestion" key={s.id}>
                  <span>{s.field}</span>
                  <p>{s.value}</p>
                  <small>
                    {s.status === "confirmed"
                      ? "Confirmed by contributor · not verified"
                      : s.status === "removed"
                        ? "Removed / not applied"
                        : s.status === "uncertain"
                          ? "Uncertain"
                          : "Suggested by AI · demo"}
                  </small>
                </div>
              ))}
            </>
          )}
          <button
            className="subtle-button"
            style={{ marginTop: 25 }}
            onClick={() =>
              downloadDraft({
                ...item,
                files: item.files.map((f) => ({
                  id: f.id,
                  name: f.originalName,
                  role: f.role,
                  bytes: f.file.size,
                  mimeType: f.file.type,
                })),
                disclaimer:
                  "Demo metadata only. Original image and audio bytes are not included.",
              })
            }
          >
            Export capture details
            <Download size={15} />
          </button>
        </section>
      </div>
      <details className="processing-phases">
        <summary>What happens after capture?</summary>
        <ol>
          {phases.map((s, i) => (
            <li key={s}>
              <span>{String(i + 1).padStart(2, "0")}</span>
              {s}
            </li>
          ))}
        </ol>
        <p className="help-line">
          Capture → original → context → process → suggest → review → archive.
          These layers remain distinct.
        </p>
      </details>
      {["Letter","Document","Postcard"].includes(item.kind) && <p>Original pages saved. Transcription is optional after connecting your private archive.</p>}
    </div>
  );
}
