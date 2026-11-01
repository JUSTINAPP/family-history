"use client";
import Link from "next/link";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { identifyPersonAction } from "@/lib/backend/identification-actions";
import { matchingPeople, type Identification } from "@/lib/identifications";
import type { Person, MemberRole } from "@/lib/types";
import { can } from "@/lib/permissions";

export function IdentificationForm({
  archiveId,
  itemId,
  people,
  identifications,
  role,
  profileId,
  canCreate = false,
  unavailable = false,
  simple = false,
}: {
  archiveId: string;
  itemId: string;
  people: Person[];
  identifications: Identification[];
  role: MemberRole;
  profileId: string;
  canCreate?: boolean;
  unavailable?: boolean;
  simple?: boolean;
}) {
  const router = useRouter();
  const [query, setQuery] = useState(""),
    [adding, setAdding] = useState(false),
    [creating, setCreating] = useState(false),
    [linking, setLinking] = useState<Identification | null>(null),
    [message, setMessage] = useState(""),
    [busy, setBusy] = useState(false);
  const editor = can(role, "editor"),
    canReport = can(role, "commenter");
  const active = identifications.filter((i) => i.status !== "rejected");
  const linked = active.filter((i) => i.person_id),
    unlinked = active.filter((i) => !i.person_id);
  const matches = matchingPeople(people, query)
    .filter((p) => linking || !linked.some((i) => i.person_id === p.id))
    .slice(0, 30);
  async function perform(action: string, values: Record<string, string>) {
    setBusy(true);
    setMessage("");
    try {
      const form = new FormData();
      form.set("action", action);
      Object.entries(values).forEach(([key, value]) => form.set(key, value));
      const result = await identifyPersonAction(archiveId, itemId, form);
      if (result.error) setMessage(result.error);
      else {
        setMessage(
          simple ? (action === "remove" ? "Person removed." : "Person saved.") : action === "remove"
            ? "Association removed. The Person and original report are retained."
            : action === "confirm"
              ? "Identification confirmed by an Editor."
              : "Identification saved. Reported identity remains open to review.",
        );
        setQuery("");
        setAdding(false);
        setCreating(false);
        setLinking(null);
        router.refresh();
      }
    } catch {
      setMessage("Identification could not be saved. Please retry.");
    } finally {
      setBusy(false);
    }
  }
  return (
    <section className="item-people" aria-label="People in this item">
      <h2>{simple ? "Who" : "People"}</h2>
      {unavailable && (
        <p role="alert">
          People or identifications could not load completely. Reload before
          making changes.
        </p>
      )}
      {linked.length ? (
        <ul className="people-associations">
          {linked.map((i) => {
            const person = people.find((p) => p.id === i.person_id);
            return (
              <li key={i.id}>
                <strong>{person?.name || i.proposed_name}</strong>{" "}
                <Link
                  href={`/people/${person?.id || i.person_id}?archive=${archiveId}`}
                >
                  View person ↗
                </Link>
                <details open={!simple}>
                  <summary>Identification details</summary>
                  <p>{i.status === "accepted" ? "confirmed ✓" : "reported"}</p>
                  {i.role_context && <p>Connection: {i.role_context}</p>}
                <p className="help-line">
                  Originally reported by{" "}
                  {i.proposed_by === profileId
                    ? "you"
                    : "an archive contributor"}
                  {i.created_at
                    ? ` · ${new Date(i.created_at).toLocaleDateString("en-AU", { timeZone: "Australia/Sydney" })}`
                    : ""}
                  . {i.proposed_name && `Reported name: ${i.proposed_name}.`}
                </p>
                {!unavailable && editor && i.status === "reported" && (
                  <button
                    className="subtle-button"
                    disabled={busy}
                    onClick={() =>
                      void perform("confirm", { identificationId: i.id })
                    }
                  >
                    Confirm reported identification
                  </button>
                )}
                </details>
                {!unavailable &&
                  (editor ||
                    (canReport &&
                      i.proposed_by === profileId &&
                      i.status === "reported")) && (
                    <button
                      className="subtle-button"
                      disabled={busy}
                      aria-label={`Remove association with ${person?.name || i.proposed_name}`}
                      onClick={() =>
                        void perform("remove", { identificationId: i.id })
                      }
                    >
                      Remove association
                    </button>
                  )}
              </li>
            );
          })}
        </ul>
      ) : (
        <p>No People linked yet.</p>
      )}
      {!!unlinked.length && (
        <details open={!simple}><summary>Earlier names and review</summary><div>
          <h3>Reported identifications awaiting a Person link</h3>
          {unlinked.map((i) => (
            <div key={i.id}>
              <p>{i.proposed_name} · reported</p>
              <p className="help-line">
                Original contributor report retained. Linking does not confirm
                the identity.
              </p>
              {editor && !unavailable && (
                <button
                  className="subtle-button"
                  disabled={busy}
                  onClick={() => {
                    setLinking(i);
                    setQuery(i.proposed_name);
                    setAdding(true);
                    setCreating(false);
                  }}
                >
                  Link to existing person
                </button>
              )}
            </div>
          ))}
        </div></details>
      )}
      {identifications.some((i) => i.status === "rejected") && (
        <details>
          <summary>Identification history</summary>
          {identifications
            .filter((i) => i.status === "rejected")
            .map((i) => (
              <p key={i.id}>
                {i.proposed_name} · association removed; original contributor
                report retained.
              </p>
            ))}
        </details>
      )}
      {canReport && !unavailable && (
        <button
          className="subtle-button"
          disabled={busy}
          onClick={() => {
            setAdding(true);
            setQuery("");
            setLinking(null);
            setCreating(false);
          }}
        >
          + Add person
        </button>
      )}
      {adding && canReport && !unavailable && (
        <div className="notice">
          <h3>
            {linking
              ? `Link “${linking.proposed_name}” to a Person`
              : "Who do you recognise?"}
          </h3>
          <label className="field">
            <span>Search People in this archive</span>
            <input
              type="search"
              value={query}
              maxLength={200}
              onChange={(e) => setQuery(e.target.value)}
            />
          </label>
          <ul aria-label="Matching People">
            {matches.map((p) => (
              <li key={p.id}>
                <button
                  className="subtle-button"
                  disabled={busy}
                  onClick={() =>
                    void perform(linking ? "link" : "add", {
                      personId: p.id,
                      ...(linking ? { identificationId: linking.id } : {}),
                    })
                  }
                >
                  {p.name} · {p.category}
                </button>
              </li>
            ))}
          </ul>
          {!matches.length && (
            <p>No matching People. Try another part of their name.</p>
          )}
          {canCreate && !linking && (
            <button
              className="subtle-button"
              disabled={busy}
              onClick={() => setCreating(true)}
            >
              + Add new person
            </button>
          )}
          {!linking && query.trim() && (
            <button
              className="subtle-button"
              disabled={busy}
              onClick={() => void perform("report", { name: query })}
            >
              Save name as an unlinked report
            </button>
          )}
          <button
            className="subtle-button"
            disabled={busy}
            onClick={() => {
              setAdding(false);
              setCreating(false);
              setLinking(null);
            }}
          >
            Cancel adding person
          </button>
          {creating && canCreate && (
            <form
              onSubmit={(e) => {
                e.preventDefault();
                const data = new FormData(e.currentTarget);
                void perform("create", {
                  name: String(data.get("name") || ""),
                  category: String(data.get("category") || "other"),
                });
              }}
            >
              <label className="field">
                <span>Name</span>
                <input
                  name="name"
                  defaultValue={query}
                  required
                  maxLength={200}
                />
              </label>
              <label className="field">
                <span>Relationship/category if known</span>
                <select name="category" defaultValue="other">
                  <option value="other">Not yet known / Other</option>
                  <option value="family">Family</option>
                  <option value="friend">Friend</option>
                  <option value="unidentified">Unidentified</option>
                </select>
              </label>
              <button className="button" disabled={busy}>
                Create Person and link to this item
              </button>
            </form>
          )}
        </div>
      )}
      {!simple && <>
      <p className="help-line">
        Reported: a contributor recognises someone. Confirmed: an Editor has
        reviewed the identity. Machine suggestions remain separate until human
        review.
      </p>
      </>}
      {message && <p role="status">{message}</p>}
    </section>
  );
}
