import { ItemTypeField } from "./item-type-field";
import { DocumentActions } from "./document-actions";
import { ReviewedDocumentNotes } from "./reviewed-document-notes";
import { DocumentReader } from "./document-reader";
import { documentKinds } from "@/lib/documents/types";
import { QuickField } from "./quick-field";
import { ImageOptions } from "./image-options";
import { FamilyConversation } from "./family-conversation";
import { cataloguePresentation } from "@/lib/catalogue-presentation";
import { loadPlaceData } from "@/lib/backend/places";
import { LiveWorkspaceProvider } from "./live-workspace";
import type { RecordingView } from "@/lib/audio/repository";
import { AudioCapture } from "../audio/audio-capture";
import { Recordings } from "../audio/recordings";
import { loadRecordings } from "@/lib/audio/repository";
import { requireSession } from "@/lib/backend/repository";
import { can } from "@/lib/permissions";
import { IdentificationForm } from "./identification-form";
import { ItemPlaces } from "./item-places";
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
  let placeName = item.reported_place || "";
  try {
    const placeData = await loadPlaceData(item.archive_id, item.id);
    const link = placeData.links.find(l => l.status !== "removed" && l.role === "primary") || placeData.links.find(l => l.status !== "removed");
    placeName = placeData.places.find(p => p.id === link?.place_id)?.name || placeName;
  } catch { /* The Place section provides its own retry message. */ }
  const display = cataloguePresentation({kind: item.kind || "Other", title: item.title, datePrecision: item.date_precision,
    people: [...new Set(identifications.filter(i => i.person_id && ["reported", "accepted"].includes(i.status)).map(i => snapshot.people.find(p => p.id === i.person_id)?.name || "Person linked"))],
    place: placeName, date: item.reported_date, notes: item.notes || item.people_text,
    hasRecollection: recollections.length > 0, catalogued: !!item.catalogued_at});
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
          eyebrow="FROM YOUR FAMILY ARCHIVE"
          title={display.title}
          description="A familiar face, a place, a little of what we remember."
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
        {can(role, "editor") &&
          item.kind === "Photograph" &&
          item.grouping_kind === "single_object" &&
          files.filter((f) => f.purpose === "original").length > 1 && (
            <section className="notice">
              <h2>Separate these photographs</h2>
              <p>
                These photographs were originally added together. Separate them so each photograph can have its own people, place, date and recollections.
              </p>
              <Link
                className="button"
                href={`/archive/${item.id}/manage?split=1`}
              >
                Separate photographs
              </Link>
            </section>
          )}
        {item.split_from && (
          <p className="notice">
            These photographs were originally added together. {can(role, "editor") && <Link href={`/archive/${item.split_from}/manage#earlier-notes`}>Review earlier notes ↗</Link>}
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
            <ItemTypeField key={item.kind} archiveId={item.archive_id} itemId={item.id} kind={item.kind} editable={editable && item.lifecycle === "active" && !item.archived_at && item.ingestion_status === "ready"}/>
            {item.kind === "Audio" && (
              <Recordings recordings={recordings} snapshot={snapshot} />
            )}
            {documentKinds.includes(item.kind) && <>
              <DocumentActions itemId={item.id} kind={item.kind} canProcess={editable && item.lifecycle === "active" && !item.archived_at && item.ingestion_status === "ready"}/>
              <DocumentReader pages={files.filter(f => f.purpose === "original")} sets={result.imageSets} title={display.title} editable={editable && !item.archived_at && item.ingestion_status === "ready"} />
            </>}
            {!documentKinds.includes(item.kind) && files
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
                    rotation={file.presentation_rotation || 0}
                    priority={index === 0}
                    originalPreserved={true}
                  />
                  <ImageOptions sourceId={file.id} rotation={file.presentation_rotation || 0} editable={editable && !item.archived_at && item.ingestion_status === "ready"} />
                  <details className="archive-information"><summary>Original file information</summary>
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
                  </p></details>
                </div>
              ))}
          </section>
          <section className="saved-context">
            <FamilyConversation archiveId={item.archive_id} itemId={item.id} comments={result.comments}
              profileId={snapshot.profileId} names={Object.fromEntries(snapshot.members.map(m => [m.profileId, m.name]))}
              canComment={can(role, "commenter") && item.lifecycle === "active" && !item.archived_at && item.ingestion_status === "ready"}
              editor={can(role, "editor")} unavailable={result.commentsUnavailable} />
            <IdentificationForm
              archiveId={snapshot.archive.id}
              itemId={item.id}
              people={snapshot.people}
              identifications={identifications}
              role={role}
              profileId={snapshot.profileId}
              canCreate={editable}
              simple
              unavailable={
                result.resourceWarnings.length > 0 ||
                snapshot.resourceWarnings.includes("People could not load.")
              }
            />
            <QuickField archiveId={item.archive_id} itemId={item.id} field="date" value={item.reported_date || ""} precision={item.date_precision} editable={editable && item.ingestion_status === "ready" && item.lifecycle === "active"} />
            <ItemPlaces
              archiveId={item.archive_id}
              itemId={item.id}
              reportedText={item.reported_place || ""}
              editable={editable}
              editor={can(role, "editor")}
              profileId={snapshot.profileId}
              simple
            />
            <details><summary>Edit caption</summary><QuickField archiveId={item.archive_id} itemId={item.id} field="caption" value={item.title || ""} editable={editable} /></details>
            <p className="eyebrow">MEMORIES FROM THE FAMILY</p>
            <h2>What we know so far.</h2>
            {written.length ? (
              written.map((r) => (
                <div key={r.id}>
                  <blockquote>{r.original_text}</blockquote>
                  <p className="help-line">
                    {snapshot.members.find(m => m.profileId === r.contributor_id)?.name || "Archive contributor"} ·{" "}
                    {new Date(r.recorded_at).toLocaleDateString("en-AU", {
                      timeZone: "Australia/Sydney",
                    })}{" "}

                  </p>
                </div>
              ))
            ) : (
              <p className="prose">
                No recollection yet. Preserving the original is enough to begin.
              </p>
            )}
            <details className="archive-information"><summary>Archive information</summary>
            <dl className="metadata-grid" style={{ marginTop: 30 }}>
              {[
                ["Previously reported people (text)", item.people_text],
                ["Item type", item.kind],
                [
                  "Catalogue state",
                  display.catalogueState,
                ],
                ["When", item.reported_date],
                ["Reported Where (text)", item.reported_place],
                ["Date certainty", item.date_precision],
              ].map(([label, value]) => (
                <div key={label}>
                  <dt>{label}</dt>
                  <dd>{value || "Not yet known"}</dd>
                </div>
              ))}
            </dl>

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
            </div></details>
            {item.notes && <p className="prose">{item.notes}</p>}
            {documentKinds.includes(item.kind) && <ReviewedDocumentNotes itemId={item.id} archiveId={item.archive_id}/>}

            <details className="add-memory"><summary>Add a memory</summary><p>A longer recollection becomes part of the archive, separately from the conversation.</p><AddRecollection archiveId={snapshot.archive.id} itemId={item.id} /></details>
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
                <summary>Add a voice memory</summary>
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
