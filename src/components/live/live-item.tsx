import { can } from "@/lib/permissions";
import { IdentificationForm } from "./identification-form";
import { notFound } from "next/navigation";
import Link from "next/link";
import { loadItem } from "@/lib/backend/repository";
import { ArchiveImage, PageIntro } from "../ui";
import { AddRecollection } from "./recollection-form";
export async function LiveItem({ id }: { id: string }) {
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
  return (
    <div className="page-shell">
      <div className="breadcrumb">
        <Link href="/explore">The archive</Link>
        <span>/</span>
        <span>{item.kind}</span>
      </div>
      <PageIntro
        eyebrow="PRESERVED IN YOUR PRIVATE ARCHIVE"
        title={item.title}
        description="Original material and contributor context are kept separately. No AI analysis has run."
      />
      {editable && (
        <p>
          <Link className="text-link" href={`/archive/${item.id}/edit`}>
            Edit catalogue details ↗
          </Link>
        </p>
      )}
      <div className="saved-material-layout">
        <section>
          {files
            .filter((file) => file.purpose === "original")
            .map((file) => (
              <div key={file.id} style={{ marginBottom: 25 }}>
                <ArchiveImage
                  src={`/api/v1/previews/${file.id}`}
                  alt={`${item.title} · ${file.page_role}`}
                  className="saved-original"
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
          {recollections.length ? (
            recollections.map((r) => (
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
          <Link href="/add" className="text-link" style={{ marginTop: 25 }}>
            Capture the next item ↗
          </Link>
        </section>
      </div>
    </div>
  );
}
