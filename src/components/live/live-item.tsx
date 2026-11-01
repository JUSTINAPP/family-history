import { LiveWorkspaceProvider } from "./live-workspace";
import type { RecordingView } from "@/lib/audio/repository";
import { AudioCapture } from "../audio/audio-capture";
import { Recordings } from "../audio/recordings";
import { loadRecordings } from "@/lib/audio/repository";
import { requireSession } from "@/lib/backend/repository";
import { can } from "@/lib/permissions";
import { IdentificationForm } from "./identification-form";
import { notFound } from "next/navigation";
import Link from "next/link";
import { loadItem } from "@/lib/backend/repository";
import { ArchiveImage, PageIntro } from "../ui";
import { AddRecollection } from "./recollection-form";
export async function LiveItem({
  id,
  saved = false,
}: {
  id: string;
  saved?: boolean;
}) {
  const result = await loadItem(id);
  if (!result) notFound();
  const { item, files, recollections, snapshot, identifications } = result;
  const role =
    snapshot.members.find(
      (m) => m.profileId === snapshot.profileId && m.status === "active",
    )?.role || "viewer";
  const editable =
    can(role, "editor") ||
    (can(role, "contributor") &&
      item.contributed_by === snapshot.profileId &&
      item.evidence_status !== "verified");
  const { client } = await requireSession();
  let recordings: RecordingView[] = [];
  let audioUnavailable = false;
  try {
    recordings = await loadRecordings(client, snapshot.archive.id, item.id);
  } catch {
    audioUnavailable = true;
  }
  const audioRecollections = new Set(recordings.map((r) => r.recollectionId));
  const written = recollections.filter(
    (r) => !audioRecollections.has(r.id) && r.original_text,
  );
  return (
    <LiveWorkspaceProvider
      key={`${snapshot.archive.id}:${item.id}`}
      snapshot={snapshot}
    >
      <div className="page-shell">
        <div className="breadcrumb">
          <Link href={`/explore?archive=${snapshot.archive.id}`}>
            {snapshot.archive.name}
          </Link>
          <span>/</span>
          <span>{item.kind}</span>
        </div>
        <PageIntro
          eyebrow="PRESERVED IN YOUR PRIVATE ARCHIVE"
          title={
            item.title?.trim() ||
            `${item.kind || "Archive item"}, still to be catalogued`
          }
          description="Original material and contributor context are kept separately. No AI analysis has run."
        />
        {saved && item.ingestion_status === "ready" && (
          <section className="notice" role="status">
            <h2>
              1 item safely saved
              {files.length
                ? ` · ${files.filter((f) => f.purpose === "original" || f.purpose === "audio_original").length} original files preserved`
                : ""}
            </h2>
            <a
              className="text-link"
              href={`/explore?archive=${snapshot.archive.id}`}
            >
              View everything in this archive ↗
            </a>
          </section>
        )}
        {item.ingestion_status !== "ready" && (
          <p className="notice">
            This item is available. Its upload receipt is incomplete; existing
            original files have not been replaced or removed.
          </p>
        )}
        {result.resourceWarnings.length > 0 && (
          <p className="notice">
            Some item details could not load. The item is still available;
            reload to retry.
          </p>
        )}
        {item.archived_at && (
          <p className="notice">
            Archived item · removed from normal browsing.
          </p>
        )}
        {can(role, "editor") && (
          <p>
            <Link className="text-link" href={`/archive/${item.id}/manage`}>
              Manage item ↗
            </Link>
          </p>
        )}
        {item.split_from && (
          <p className="notice">
            Separated from a grouped photograph item. Its previous context was
            retained for editorial review.
          </p>
        )}
        {editable && item.kind !== "Audio" && (
          <p>
            <Link className="text-link" href={`/archive/${item.id}/edit`}>
              Edit catalogue details ↗
            </Link>
          </p>
        )}
        <div className="saved-material-layout">
          <section>
            {item.kind === "Audio" && (
              <Recordings recordings={recordings} snapshot={snapshot} />
            )}
            {files
              .filter((file) => file.purpose === "original")
              .map((file, index) => (
                <div key={file.id} style={{ marginBottom: 25 }}>
                  <ArchiveImage
                    src={`/api/v1/previews/${file.id}`}
                    alt={`${item.title} · ${file.page_role}`}
                    className="saved-original"
                    imageSet={result.imageSets.find(
                      (s) => s.originalId === file.id,
                    )}
                    priority={index === 0}
                    originalPreserved={true}
                  />
                  <div className="saved-file-list">
                    <a
                      href={`/api/v1/files/${file.id}`}
                      download={file.original_filename}
                    >
                      {file.original_filename} · {file.page_role} ↗
                    </a>
                  </div>
                  <p className="help-line">
                    Original · {Number(file.byte_size).toLocaleString("en-AU")}{" "}
                    bytes · SHA-256 {file.sha256}
                    <br />
                    No optimisation was applied to this file.
                  </p>
                </div>
              ))}
          </section>
          <section className="saved-context">
            <p className="eyebrow">CONTRIBUTOR RECOLLECTIONS</p>
            <h2>What we know so far.</h2>
            {written.length ? (
              written.map((r) => (
                <div key={r.id}>
                  <blockquote>{r.original_text}</blockquote>
                  <p className="help-line">
                    Reported by a contributor ·{" "}
                    {new Date(r.recorded_at).toLocaleDateString("en-AU", {
                      timeZone: "Australia/Sydney",
                    })}{" "}
                    · unverified
                  </p>
                </div>
              ))
            ) : (
              <p className="prose">
                No recollection yet. Preserving the original is enough to begin.
              </p>
            )}
            <dl className="metadata-grid" style={{ marginTop: 30 }}>
              {[
                ["People", item.people_text],
                ["When", item.reported_date],
                ["Where", item.reported_place],
                ["Date certainty", item.date_precision],
              ].map(([label, value]) => (
                <div key={label}>
                  <dt>{label}</dt>
                  <dd>{value || "Not yet known"}</dd>
                </div>
              ))}
            </dl>
            {item.notes && <p className="prose">{item.notes}</p>}
            <p className="help-line">
              Created{" "}
              {new Date(item.created_at).toLocaleDateString("en-AU", {
                timeZone: "Australia/Sydney",
              })}{" "}
              by{" "}
              {snapshot.members.find((m) => m.profileId === item.contributed_by)
                ?.name || "Archive contributor"}
              .{" "}
              {item.last_edited_by &&
                `Last edited ${new Date(item.updated_at).toLocaleDateString("en-AU", { timeZone: "Australia/Sydney" })} by ${snapshot.members.find((m) => m.profileId === item.last_edited_by)?.name || "Archive member"}.`}
            </p>
            <div className="notice">
              Original files are preserved unchanged. Display previews are
              separate copies.
            </div>
            {identifications.length > 0 && (
              <div>
                <h3>Identification suggestions</h3>
                {identifications.map((i) => (
                  <p key={i.id}>
                    {i.proposed_name} · {i.status}
                  </p>
                ))}
              </div>
            )}
            <IdentificationForm
              archiveId={snapshot.archive.id}
              itemId={item.id}
            />
            <AddRecollection archiveId={snapshot.archive.id} itemId={item.id} />
            {audioUnavailable && (
              <p className="help-line">
                Voice recordings could not load. Other item details remain
                available.
              </p>
            )}
            {item.kind !== "Audio" && (
              <Recordings recordings={recordings} snapshot={snapshot} />
            )}
            {can(role, "contributor") && (
              <details className="audio-metadata">
                <summary>Add a voice recollection</summary>
                <AudioCapture itemId={item.id} />
              </details>
            )}
            <Link href="/add" className="text-link" style={{ marginTop: 25 }}>
              Capture the next item ↗
            </Link>
          </section>
        </div>
      </div>
    </LiveWorkspaceProvider>
  );
}
