"use client";
import Link from "next/link";
import { useState } from "react";
import { useRouter } from "next/navigation";
import type { ManagementSnapshot } from "@/lib/backend/item-management";
import { manageItemAction } from "@/lib/backend/management-actions";
import { ImageDiagnostics } from "./image-diagnostics";
export function ItemManager({
  snapshot,
  initialSplit = false,
}: {
  snapshot: ManagementSnapshot;
  initialSplit?: boolean;
}) {
  const { item, counts, files } = snapshot;
  const router = useRouter();
  const [mode, setMode] = useState(initialSplit ? "split" : ""),
    [phrase, setPhrase] = useState(""),
    [ack, setAck] = useState(false),
    [busy, setBusy] = useState(false),
    [message, setMessage] = useState("");
  const originals = files.filter(
    (f) => f.purpose === "original" || f.purpose === "audio_original",
  );
  async function perform(action: string) {
    setBusy(true);
    setMessage("");
    try {
      const form = new FormData();
      form.set("itemId", item.id);
      form.set("action", action);
      form.set("version", snapshot.version);
      form.set("confirmation", phrase);
      form.set("acknowledge", ack ? "yes" : "no");
      if (action === "split") form.set("confirmed", "yes");
      const result = await manageItemAction(form);
      if (result.error) setMessage(result.error);
      else if (result.deleted)
        router.push(`/explore?archive=${result.archiveId}`);
      else {
        setMode("");
        setPhrase("");
        setAck(false);
        setMessage(
          action === "split"
            ? "Photographs separated. You can now review earlier notes below."
            : "Item updated.",
        );
        router.refresh();
      }
    } catch {
      setMessage(
        "The operation was interrupted. Reload to check progress before retrying.",
      );
    } finally {
      setBusy(false);
    }
  }
  async function regenerate() {
    setBusy(true);
    setMessage("");
    try {
      for (const file of originals.filter((f) => f.purpose === "original")) {
        const response = await fetch(
          `/api/v1/previews/${file.id}?regenerate=1`,
          { method: "POST" },
        );
        const result = await response.json();
        if (!response.ok)
          throw new Error(result.error || "Image preparation failed.");
      }
      setMessage(
        "Display images, thumbnails and placeholders prepared. Originals unchanged.",
      );
      router.refresh();
    } catch (error) {
      setMessage(
        error instanceof Error
          ? error.message
          : "Please retry image preparation.",
      );
    } finally {
      setBusy(false);
    }
  }
  if (mode === "split") return (
    <section className="notice" role="dialog" aria-labelledby="separate-title" tabIndex={-1} ref={node => node?.focus()}>
      <h2 id="separate-title">Separate {originals.length} photographs?</h2>
      <p>Each photograph will become its own archive item. The original files will remain unchanged.</p>
      <button className="subtle-button" disabled={busy} onClick={() => initialSplit ? router.push(`/archive/${item.id}`) : setMode("")}>Cancel</button>
      <button className="button" disabled={busy} onClick={() => void perform("split")}>{busy ? "Separating…" : "Separate photographs"}</button>
      {message && <p role="status">{message}</p>}
    </section>
  );
  return (
    <div className="management-panel">
      <p>
        <Link className="text-link" href={`/archive/${item.id}`}>
          Back to item ↗
        </Link>{" "}
        ·{" "}
        <Link href={`/explore?archive=${item.archive_id}&state=archived`}>
          Archived items ↗
        </Link>
      </p>
      <details><summary>Image details and preparation</summary>
      <p>
        {item.archived_at ? "Archived" : "Active"} · {counts.originals}{" "}
        originals · {counts.derivatives} derived files · {counts.recollections}{" "}
        recollections
      </p>
      <ul>
        {originals.map((f) => (
          <li key={f.id}>
            {f.name} · {Number(f.size).toLocaleString()} bytes
          </li>
        ))}
      </ul>
      <ImageDiagnostics files={files} /></details>
      {item.lifecycle === "deleting" ? (
        <p className="notice">
          Permanent deletion is in progress. It cannot be restored. Retry below
          to finish Storage and database cleanup.
        </p>
      ) : (
        <>
          <p>
            <Link className="text-link" href={`/archive/${item.id}/edit`}>
              Edit catalogue details ↗
            </Link>
          </p>
          {item.grouping_kind !== "split_context" && (
            <button
              className="subtle-button"
              disabled={busy}
              onClick={() =>
                void perform(item.archived_at ? "restore" : "archive")
              }
            >
              {item.archived_at ? "Restore archived item" : "Archive item"}
            </button>
          )}
          {!!originals.filter((f) => f.purpose === "original").length && (
            <button
              className="subtle-button"
              disabled={busy}
              onClick={() => void regenerate()}
            >
              Regenerate display images and thumbnails
            </button>
          )}
          {item.kind === "Photograph" &&
            item.grouping_kind === "single_object" &&
            originals.length > 1 && (
              <button
                className="subtle-button"
                disabled={busy}
                onClick={() => {
                  setMode("split");
                  setPhrase("");
                  setAck(false);
                }}
              >
                Separate photographs
              </button>
            )}
        </>
      )}
      {!!snapshot.children.length && (
        <section className="notice">
          <h2>Separated photographs</h2>
          <p>Each photograph now has its own catalogue details. Earlier notes are kept safely for review below.</p>
          <ul>
            {snapshot.children.map((child, index) => (
              <li key={child.id}>
                <Link href={`/archive/${child.id}`}>
                  Open photograph {index + 1} ↗
                </Link>{" "}
                · <Link href={`/archive/${child.id}/edit`}>Catalogue ↗</Link>
              </li>
            ))}
          </ul>
        </section>
      )}
      <section className="management-danger">
        <h2>Permanently delete item</h2>
        <p>
          Archive the item first. Permanent deletion removes its original files,
          all derivative versions and placeholders, catalogue metadata,
          recollections, recordings, transcripts, comments, identifications,
          suggestions, jobs and item provenance. Cover/portrait references and
          links to this item are cleared. People and other items remain. Only a
          minimal audit of actor, time, item ID and counts remains.
        </p>
        {snapshot.children.length > 0 ? (
          <p>
            The archived context must remain while its separated photographs
            exist.
          </p>
        ) : (
          <button
            className="subtle-button"
            disabled={busy || !item.archived_at}
            onClick={() => {
              setMode("delete");
              setPhrase("");
              setAck(false);
            }}
          >
            Review permanent deletion
          </button>
        )}
        {mode === "delete" && (
          <div className="notice">
            <h3>Delete “{item.title}” permanently?</h3>
            <p>
              {counts.originals} original files, {counts.derivatives} derived
              files, {counts.recollections} recollections, {counts.comments}{" "}
              comments, {counts.transcriptions} transcriptions and{" "}
              {counts.provenance} provenance records will be removed. This
              cannot be undone. Interrupted deletion must be resumed here; it
              cannot be cancelled after file removal starts.
            </p>
            <label>
              Type DELETE
              <input
                aria-label="Delete confirmation"
                value={phrase}
                onChange={(e) => setPhrase(e.target.value)}
              />
            </label>
            <label>
              <input
                type="checkbox"
                checked={ack}
                onChange={(e) => setAck(e.target.checked)}
              />{" "}
              I confirm permanent removal of all listed material.
            </label>
            <button
              className="button"
              disabled={busy || phrase !== "DELETE" || !ack}
              onClick={() => void perform("delete")}
            >
              Confirm permanent deletion
            </button>
            <button
              className="subtle-button"
              disabled={busy}
              onClick={() => setMode("")}
            >
              Cancel
            </button>
          </div>
        )}
      </section>
      {message && (
        <p role="status" className="notice">
          {message}
        </p>
      )}
    </div>
  );
}
