import { PrivateAudio } from "./private-player";
import Link from "next/link";
import type { RecordingView } from "@/lib/audio/repository";
import type { LiveSnapshot } from "@/lib/backend/repository";
import { can } from "@/lib/permissions";
export function Recordings({
  recordings,
  snapshot,
}: {
  recordings: RecordingView[];
  snapshot: LiveSnapshot;
}) {
  const role =
    snapshot.members.find(
      (m) => m.profileId === snapshot.profileId && m.status === "active",
    )?.role || "viewer";
  return (
    <div>
      {recordings.map((recording) => {
        const speaker =
          recording.metadata.speaker ||
          snapshot.people.find(
            (p) => p.id === recording.metadata.speakerPersonId,
          )?.name ||
          "Speaker not yet named";
        const contributor = recording.contributorName;
        const editable =
          can(role, "editor") ||
          (can(role, "contributor") &&
            recording.contributorId === snapshot.profileId &&
            !recording.archived);
        return (
          <article key={recording.id} className="audio-recording">
            <p className="eyebrow">
              {recording.archived ? "ARCHIVED RECORDING" : "VOICE RECOLLECTION"}
            </p>
            <h3>{recording.metadata.title}</h3>
            <p>
              {speaker} ·{" "}
              {recording.metadata.recordedDate ||
                "Recording date not yet known"}
              {recording.metadata.precision === "approximate"
                ? " (approximate)"
                : ""}
            </p>
            <p className="help-line">
              Contributed by {contributor} · uploaded{" "}
              {new Date(recording.createdAt).toLocaleDateString("en-AU", {
                timeZone: "Australia/Sydney",
              })}
            </p>
            <PrivateAudio
              fileId={recording.fileId}
              title={recording.metadata.title}
            />
            {recording.durationMs !== null && (
              <p className="help-line">
                Duration {Math.floor(recording.durationMs / 60000)}:
                {String(Math.floor(recording.durationMs / 1000) % 60).padStart(
                  2,
                  "0",
                )}
              </p>
            )}
            {recording.metadata.description && (
              <p>{recording.metadata.description}</p>
            )}
            {recording.metadata.location && (
              <p>Location: {recording.metadata.location}</p>
            )}
            {recording.metadata.tags.length > 0 && (
              <p className="help-line">{recording.metadata.tags.join(" · ")}</p>
            )}
            {recording.people.length > 0 && (
              <p>
                Related people:{" "}
                {recording.people
                  .map(
                    (id) =>
                      snapshot.people.find((p) => p.id === id)?.name ||
                      "Archive person",
                  )
                  .join(", ")}
              </p>
            )}
            {recording.items.length > 0 && (
              <p>
                Related items:{" "}
                {recording.items.map((id) => (
                  <Link
                    key={id}
                    href={`/archive/${id}`}
                    style={{ marginRight: 12 }}
                  >
                    {snapshot.catalogue.find((i) => i.id === id)?.title ||
                      "Archive item"}{" "}
                    ↗
                  </Link>
                ))}
              </p>
            )}
            <div className="import-actions">
              <a
                className="text-link"
                href={`/api/v1/files/${recording.fileId}?download=1`}
                download={recording.fileName}
              >
                Download original ↗
              </a>
              {editable && (
                <Link
                  href={`/audio/${recording.id}/edit`}
                  className="text-link"
                >
                  Attach to photos / edit details ↗
                </Link>
              )}
            </div>
            <details>
              <summary>Original recording details</summary>
              <p className="help-line">
                {recording.fileName} · {recording.mime} ·{" "}
                {recording.size.toLocaleString("en-AU")} bytes
                <br />
                SHA-256 {recording.sha256}
                <br />
                Original audio preserved unchanged. No transcript has been
                generated.
              </p>
            </details>
          </article>
        );
      })}
    </div>
  );
}
