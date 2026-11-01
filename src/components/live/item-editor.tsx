"use client";
import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { catalogueItemAction } from "@/lib/backend/actions";
interface EditableItem {
  id: string;
  archive_id: string;
  title: string;
  kind: string;
  notes: string;
  people_text: string;
  reported_date: string;
  date_precision: string;
  reported_place: string;
}
export function ItemEditor({
  item,
  nextId,
  batchId,
}: {
  item: EditableItem;
  nextId?: string;
  batchId?: string;
}) {
  const router = useRouter();
  const operation = useRef<{ signature: string; id: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  async function save(form: HTMLFormElement, next: boolean) {
    setBusy(true);
    setMessage("");
    try {
      const data = new FormData(form);
      const signature = JSON.stringify(Array.from(data.entries()));
      if (!operation.current || operation.current.signature !== signature)
        operation.current = { signature, id: crypto.randomUUID() };
      data.set("writeId", operation.current.id);
      const result = await catalogueItemAction(item.archive_id, item.id, data);
      if (result.error) setMessage(result.error);
      else {
        setMessage("Changes saved. Original files unchanged.");
        operation.current = null;
        const words = form.elements.namedItem(
          "newRecollection",
        ) as HTMLTextAreaElement | null;
        if (words) words.value = "";
        if (next && nextId)
          router.push(
            `/archive/${nextId}/edit${batchId ? `?batch=${batchId}` : ""}`,
          );
        router.refresh();
      }
    } catch {
      setMessage(
        "Changes could not be confirmed. Check your connection, then retry.",
      );
    } finally {
      setBusy(false);
    }
  }
  return (
    <form
      className="catalogue-form"
      onSubmit={(e) => {
        e.preventDefault();
        const next =
          (e.nativeEvent as SubmitEvent).submitter?.getAttribute("value") ===
          "next";
        void save(e.currentTarget, next);
      }}
    >
      <label className="field">
        <span>Title / caption</span>
        <input
          name="title"
          defaultValue={item.title}
          required
          maxLength={300}
        />
      </label>
      <div className="catalogue-grid">
        <label className="field">
          <span>Item type</span>
          <select name="kind" defaultValue={item.kind}>
            {[
              "Photograph",
              "Letter",
              "Document",
              "Object",
              "Postcard",
              "Certificate",
              "Artwork",
              "Other",
            ].map((kind) => (
              <option key={kind}>{kind}</option>
            ))}
          </select>
        </label>
        <label className="field">
          <span>Reported people notes (text)</span>
          <input
            name="people"
            defaultValue={item.people_text}
            maxLength={1000}
            placeholder="Preserved name notes; use People below to link Person records"
          />
        </label>
        <label className="field">
          <span>Date</span>
          <input
            name="date"
            defaultValue={item.reported_date}
            maxLength={300}
            placeholder="1965, summer 1965, or 1965-06-21"
          />
        </label>
        <label className="field">
          <span>Date certainty</span>
          <select name="precision" defaultValue={item.date_precision}>
            {["unknown", "approximate", "year", "exact"].map((p) => (
              <option key={p} value={p}>
                {p}
              </option>
            ))}
          </select>
        </label>
      </div>
      <label className="field">
        <span>Place</span>
        <input
          name="place"
          defaultValue={item.reported_place}
          maxLength={1000}
        />
      </label>
      <label className="field">
        <span>Notes / context</span>
        <textarea
          name="notes"
          defaultValue={item.notes}
          maxLength={20000}
          rows={5}
        />
      </label>
      <label className="field">
        <span>Add a recollection (optional)</span>
        <textarea
          name="newRecollection"
          maxLength={20000}
          placeholder="In your own words. Kept separately from catalogue details."
        />
      </label>
      <p className="help-line">
        These are reported catalogue details. Recollections remain separate,
        attributed accounts on the item page. Saving changes records who edited
        them and when.
      </p>
      {message && (
        <p className="notice" role="status">
          {message}
        </p>
      )}
      {batchId && !nextId && (
        <p className="help-line">
          This is the last uncatalogued photograph you can edit in this import.
        </p>
      )}
      <div className="import-actions">
        <button className="button" disabled={busy} type="submit">
          {busy ? "Saving…" : "Save changes"}
        </button>
        {nextId && (
          <button
            className="subtle-button"
            type="submit"
            value="next"
            disabled={busy}
          >
            Save & next uncatalogued ↗
          </button>
        )}
        {batchId && (
          <Link
            className="text-link"
            href={`/explore?archive=${item.archive_id}&batch=${batchId}`}
          >
            View this import ↗
          </Link>
        )}
        <Link className="text-link" href={`/archive/${item.id}`}>
          Back to item
        </Link>
      </div>
    </form>
  );
}
