"use client";
import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import type { ArchivePlace } from "@/lib/places";
import { placeAction } from "@/lib/backend/place-actions";
export function PlaceFields({
  place,
  name = "",
}: {
  place?: ArchivePlace;
  name?: string;
}) {
  return (
    <>
      <label className="field">
        <span>Place name</span>
        <input
          name="name"
          required
          maxLength={200}
          defaultValue={place?.name || name}
        />
      </label>
      <details>
        <summary>More about this place (optional)</summary>
        {(["locality", "city", "region", "country"] as const).map((key) => (
          <label className="field" key={key}>
            <span>
              {
                {
                  locality: "Locality / suburb",
                  city: "City",
                  region: "State / region",
                  country: "Country",
                }[key]
              }
            </span>
            <input
              name={key}
              maxLength={300}
              defaultValue={place?.[key] || ""}
            />
          </label>
        ))}
        <label className="field">
          <span>Notes / context</span>
          <textarea
            name="notes"
            maxLength={10000}
            defaultValue={place?.notes || ""}
          />
        </label>
        <label className="field">
          <span>Latitude (optional)</span>
          <input
            type="number"
            step="any"
            name="latitude"
            min={-90}
            max={90}
            defaultValue={place?.latitude ?? ""}
          />
        </label>
        <label className="field">
          <span>Longitude (optional)</span>
          <input
            type="number"
            step="any"
            name="longitude"
            min={-180}
            max={180}
            defaultValue={place?.longitude ?? ""}
          />
        </label>
      </details>
    </>
  );
}
export function PlaceEditor({
  archiveId,
  place,
}: {
  archiveId: string;
  place?: ArchivePlace;
}) {
  const dialog = useRef<HTMLDialogElement>(null),
    router = useRouter();
  const [busy, setBusy] = useState(false),
    [message, setMessage] = useState("");
  return (
    <>
      <button
        className="button button-light"
        onClick={() => {
          setMessage("");
          dialog.current?.showModal();
        }}
      >
        {place ? "Edit place" : "Add a place"}
      </button>
      <dialog
        className="admin-dialog"
        ref={dialog}
        aria-label={place ? "Edit place" : "Add a place"}
      >
        <button
          className="dialog-close"
          aria-label="Close Place form"
          disabled={busy}
          onClick={() => dialog.current?.close()}
        >
          ×
        </button>
        <h2>{place ? "Edit this place." : "A place in the archive."}</h2>
        <p>
          Homes, neighbourhoods and meaningful family locations are welcome. A
          name is enough to begin.
        </p>
        <form
          onSubmit={async (e) => {
            e.preventDefault();
            const form = e.currentTarget;
            setBusy(true);
            try {
              const data = new FormData(form);
              data.set("action", "save");
              if (place) data.set("placeId", place.id);
              const result = await placeAction(archiveId, data);
              if (result.error) setMessage(result.error);
              else {
                if (!place) form.reset();
                dialog.current?.close();
                router.refresh();
              }
            } catch {
              setMessage("The Place could not be saved. Please retry.");
            } finally {
              setBusy(false);
            }
          }}
        >
          <PlaceFields place={place} />
          <button className="button" disabled={busy}>
            {busy ? "Saving…" : "Save place"}
          </button>
          {message && <p role="alert">{message}</p>}
        </form>
      </dialog>
    </>
  );
}
