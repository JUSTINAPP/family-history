"use client";
import Link from "next/link";
import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  matchingPlaces,
  placeSubtitle,
  type ArchivePlace,
  type ItemPlace,
} from "@/lib/places";
import { placeAction } from "@/lib/backend/place-actions";
import { PlaceFields } from "./place-editor";
export function PlacePicker({
  archiveId,
  itemId,
  places,
  links,
  reportedText,
  editable,
  editor,
  profileId,
}: {
  archiveId: string;
  itemId: string;
  places: ArchivePlace[];
  links: ItemPlace[];
  reportedText: string;
  editable: boolean;
  editor: boolean;
  profileId: string;
}) {
  const router = useRouter();
  const [query, setQuery] = useState(""),
    [open, setOpen] = useState(false),
    [creating, setCreating] = useState(false),
    [fromReport, setFromReport] = useState(false),
    [busy, setBusy] = useState(false),
    [message, setMessage] = useState("");
  const active = links.filter((l) => l.status !== "removed"),
    primary = active.find((l) => l.role === "primary");
  const canChangePrimary =
    editable &&
    (!primary ||
      editor ||
      (primary.status === "reported" && primary.created_by === profileId));
  const matches = matchingPlaces(places, query).slice(0, 30);
  async function perform(
    action: string,
    values: Record<string, string>,
    form?: FormData,
  ) {
    setBusy(true);
    setMessage("");
    try {
      const data = form || new FormData();
      data.set("action", action);
      data.set("itemId", itemId);
      data.set("fromReport", fromReport ? "yes" : "no");
      Object.entries(values).forEach(([k, v]) => data.set(k, v));
      const result = await placeAction(archiveId, data);
      if (result.error) setMessage(result.error);
      else {
        setMessage(
          action === "remove"
            ? "Association removed. The Place and original wording remain."
            : "Place association saved.",
        );
        setOpen(false);
        setCreating(false);
        setQuery("");
        setFromReport(false);
        router.refresh();
      }
    } catch {
      setMessage("Place association could not be saved. Please retry.");
    } finally {
      setBusy(false);
    }
  }
  return (
    <section
      className="item-people item-places"
      aria-label="Places in this item"
    >
      <h2>Where</h2>
      {active.length ? (
        <ul className="people-associations">
          {active.map((link) => {
            const place = places.find((p) => p.id === link.place_id);
            return (
              <li key={link.id}>
                <strong>{place?.name || "Linked Place"}</strong> · {link.status}{" "}
                {link.role !== "primary" &&
                  `· ${link.role.replaceAll("_", " ")}`}
                <p>{place && placeSubtitle(place)}</p>
                <Link href={`/places/${link.place_id}?archive=${archiveId}`}>
                  View place ↗
                </Link>
                {editor && link.status === "reported" && (
                  <button
                    className="subtle-button"
                    disabled={busy}
                    onClick={() => void perform("confirm", { linkId: link.id })}
                  >
                    Confirm reported place
                  </button>
                )}
                {(editor ||
                  (editable &&
                    link.created_by === profileId &&
                    link.status === "reported")) && (
                  <button
                    className="subtle-button"
                    disabled={busy}
                    aria-label={`Remove association with ${place?.name || "Place"}`}
                    onClick={() => void perform("remove", { linkId: link.id })}
                  >
                    Remove association
                  </button>
                )}
              </li>
            );
          })}
        </ul>
      ) : (
        <p>No Place linked yet.</p>
      )}
      {reportedText && (
        <div className="notice">
          <p>
            Originally reported Where: <q>{reportedText}</q>
          </p>
          <p className="help-line">
            Original wording is retained separately from Place records. It has
            not been matched automatically.
          </p>
          {editor && (
            <>
              <button
                className="subtle-button"
                disabled={busy}
                onClick={() => {
                  setOpen(true);
                  setCreating(false);
                  setQuery(reportedText);
                  setFromReport(true);
                }}
              >
                Link to existing place
              </button>
              <button
                className="subtle-button"
                disabled={busy}
                onClick={() => {
                  setOpen(true);
                  setCreating(true);
                  setQuery(reportedText);
                  setFromReport(true);
                }}
              >
                Create place from reported text
              </button>
            </>
          )}
        </div>
      )}
      {canChangePrimary && (
        <button
          className="subtle-button"
          disabled={busy}
          onClick={() => {
            setOpen(true);
            setCreating(false);
            setFromReport(false);
            setQuery("");
          }}
        >
          {primary ? "Change primary place" : "+ Add place"}
        </button>
      )}
      {editable && !canChangePrimary && (
        <p className="help-line">
          An Editor must review changes to this primary Place.
        </p>
      )}
      {open && canChangePrimary && (
        <div className="notice">
          <h3>Where is this?</h3>
          {primary && (
            <p>
              Selecting another Place replaces the primary association. Its
              previous report stays in history.
            </p>
          )}
          <label className="field">
            <span>Search Places in this archive</span>
            <input
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              maxLength={200}
            />
          </label>
          <ul aria-label="Matching Places">
            {matches.map((place) => (
              <li key={place.id}>
                <button
                  className="subtle-button"
                  disabled={busy}
                  onClick={() => void perform("link", { placeId: place.id })}
                >
                  {place.name}
                  {placeSubtitle(place) && ` · ${placeSubtitle(place)}`}
                </button>
              </li>
            ))}
          </ul>
          {!matches.length && (
            <p>No matching Places. Try another word or add a Place.</p>
          )}
          <button
            className="subtle-button"
            disabled={busy}
            onClick={() => setCreating(true)}
          >
            + Add new place
          </button>
          <button
            className="subtle-button"
            disabled={busy}
            onClick={() => {
              setOpen(false);
              setCreating(false);
            }}
          >
            Cancel adding place
          </button>
          {creating && (
            <form
              onSubmit={(e) => {
                e.preventDefault();
                void perform("create_link", {}, new FormData(e.currentTarget));
              }}
            >
              <PlaceFields name={query} />
              <button className="button" disabled={busy}>
                Create Place and link to this item
              </button>
            </form>
          )}
        </div>
      )}
      {links.some((l) => l.status === "removed") && (
        <details>
          <summary>Place association history</summary>
          {links
            .filter((l) => l.status === "removed")
            .map((l) => (
              <p key={l.id}>
                {places.find((p) => p.id === l.place_id)?.name || "Place"} ·
                association removed; reported wording retained.
              </p>
            ))}
        </details>
      )}
      {message && <p role="status">{message}</p>}
    </section>
  );
}
