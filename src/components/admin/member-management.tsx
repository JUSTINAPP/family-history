"use client";
import { useRef, useState } from "react";
import { X, Plus, ArrowUpRight, Check } from "lucide-react";
import { useWorkspace } from "../workspace-provider";
import { useCatalogue } from "../catalogue";
import { roleDetails, roleOrder } from "@/lib/permissions";
import type { MemberRole } from "@/lib/types";
import type { Member } from "@/lib/workspace-types";
export function RolePicker({
  value,
  onChange,
}: {
  value: MemberRole;
  onChange: (role: MemberRole) => void;
}) {
  return (
    <fieldset className="role-picker">
      <legend>Access to this archive</legend>
      {roleOrder.map((role) => (
        <label className={value === role ? "selected" : ""} key={role}>
          <input
            type="radio"
            name="archive-role"
            value={role}
            checked={value === role}
            onChange={() => onChange(role)}
          />
          <div>
            <strong>{roleDetails[role].title}</strong>
            <p>{roleDetails[role].summary}</p>
          </div>
          {value === role && <Check size={16} />}
        </label>
      ))}
      <div className="role-explanation">
        <strong>{roleDetails[value].title} can:</strong>
        <ul>
          {roleDetails[value].abilities.map((a) => (
            <li key={a}>{a}</li>
          ))}
        </ul>
      </div>
    </fieldset>
  );
}
export function PersonSelect({
  value,
  onChange,
}: {
  value: string;
  onChange: (value: string) => void;
}) {
  const { people } = useCatalogue();
  return (
    <label className="field">
      <span>
        Linked historical person <small>optional</small>
      </span>
      <select value={value} onChange={(e) => onChange(e.target.value)}>
        <option value="">No linked person</option>
        {people.map((p) => (
          <option value={p.id} key={p.id}>
            {p.name} · {p.lifespan}
          </option>
        ))}
      </select>
      <p className="field-hint">
        Link only if this member is the same person. Linking grants no extra
        access and does not change the historical record.
      </p>
    </label>
  );
}
export function InviteMember() {
  const workspace = useWorkspace();
  const dialog = useRef<HTMLDialogElement>(null);
  const [role, setRole] = useState<MemberRole>("contributor");
  const [person, setPerson] = useState("");
  const [error, setError] = useState("");
  const [sent, setSent] = useState("");
  if (workspace.mode === "live")
    return (
      <p className="help-line">Email invitations are not operational yet.</p>
    );
  return (
    <>
      <button
        className="button"
        onClick={() => {
          setSent("");
          setError("");
          setRole(workspace.settings.defaultRole);
          setPerson("");
          dialog.current?.showModal();
        }}
      >
        <Plus size={17} />
        Invite member
      </button>
      <dialog
        className="admin-dialog"
        ref={dialog}
        aria-labelledby="invite-title"
      >
        <button
          className="dialog-close"
          aria-label="Close invitation"
          onClick={() => dialog.current?.close()}
        >
          <X size={22} />
        </button>
        <p className="eyebrow">MAKE ROOM FOR ANOTHER VOICE</p>
        <h2 id="invite-title">Invite someone in.</h2>
        {sent ? (
          <div className="invitation-success" role="status">
            <Check size={32} />
            <h3>An invitation, prepared.</h3>
            <p>
              {sent} is listed as invited. This is a demo; no email was sent.
            </p>
            <p className="help-line">
              The connected archive will send a secure, expiring invitation.
              Passwords are never chosen by an administrator.
            </p>
            <button className="button" onClick={() => dialog.current?.close()}>
              Back to the archive members
              <ArrowUpRight size={16} />
            </button>
          </div>
        ) : (
          <form
            onSubmit={async (e) => {
              e.preventDefault();
              const data = new FormData(e.currentTarget);
              const name = String(data.get("name") || "").trim();
              const email = String(data.get("email") || "").trim();
              if (!name) {
                setError("Please enter a name.");
                return;
              }
              const result = await workspace.invite({
                name,
                email,
                role,
                linkedPersonId: person || null,
              });
              setError(result || "");
              if (!result) setSent(email);
            }}
          >
            <p className="dialog-intro">
              Someone helping with the collection, a trusted friend, a family
              member. Choose what they can do here.
            </p>
            <label className="field">
              <span>Name</span>
              <input name="name" required maxLength={150} autoComplete="name" />
            </label>
            <label className="field">
              <span>Email</span>
              <input
                name="email"
                type="email"
                required
                maxLength={254}
                autoComplete="email"
              />
            </label>
            <PersonSelect value={person} onChange={setPerson} />
            <RolePicker value={role} onChange={setRole} />
            <p className="demo-note">
              Demo only · no email is sent. Access applies to this archive, not
              to every archive this person may join.
            </p>
            {error && (
              <p role="alert" className="form-error">
                {error}
              </p>
            )}
            <button className="button" type="submit">
              Send invitation
              <ArrowUpRight size={17} />
            </button>
          </form>
        )}
      </dialog>
    </>
  );
}
export function MemberManagement() {
  const { people } = useCatalogue();
  const workspace = useWorkspace();
  const [selected, setSelected] = useState<Member | null>(null);
  const [role, setRole] = useState<MemberRole>("viewer");
  const [person, setPerson] = useState("");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [confirm, setConfirm] = useState(false);
  const dialog = useRef<HTMLDialogElement>(null);
  const [filter, setFilter] = useState("active");
  function open(member: Member) {
    setSelected(member);
    setRole(member.role);
    setPerson(member.linkedPersonId || "");
    setError("");
    setConfirm(false);
    dialog.current?.showModal();
  }
  async function apply(patch: Parameters<typeof workspace.updateMember>[1]) {
    if (!selected) return;
    const err = await workspace.updateMember(selected.id, patch);
    setError(err || "");
    if (!err) {
      setNotice(
        `${selected.name}’s access updated. Contributions and provenance are retained.`,
      );
      dialog.current?.close();
    }
  }
  return (
    <>
      <div className="admin-page-heading">
        <div>
          <p className="eyebrow">THE PEOPLE WITH ACCESS</p>
          <h1>Members.</h1>
          <p>Who can come in, and how they can help.</p>
        </div>
        <InviteMember />
      </div>
      <p className="demo-note">
        A member has login access. A person belongs to the historical archive.
        They may be linked, but neither requires the other. All accounts below
        are illustrative.
      </p>
      <div className="filter-tabs" aria-label="Membership status">
        {["active", "suspended", "removed", "all"].map((f) => (
          <button
            key={f}
            aria-pressed={filter === f}
            className={filter === f ? "selected" : ""}
            onClick={() => setFilter(f)}
          >
            {f[0].toUpperCase() + f.slice(1)}
          </button>
        ))}
      </div>
      {notice && (
        <p className="notice" role="status">
          {notice}
        </p>
      )}
      <div className="member-list">
        {workspace.members
          .filter((m) => filter === "all" || m.status === filter)
          .map((m) => (
            <article className="member-row" key={m.id}>
              <div className="member-identity">
                <span className="member-initials">
                  {m.name
                    .split(" ")
                    .map((s) => s[0])
                    .slice(0, 2)
                    .join("")}
                </span>
                <div>
                  <h2>{m.name}</h2>
                  <p>{m.email}</p>
                </div>
              </div>
              <dl>
                <div>
                  <dt>Role / status</dt>
                  <dd>
                    {roleDetails[m.role].title} · {m.status}
                  </dd>
                </div>
                <div>
                  <dt>Linked person</dt>
                  <dd>
                    {people.find((p) => p.id === m.linkedPersonId)?.name ||
                      "Not linked"}
                  </dd>
                </div>
                <div>
                  <dt>Last active</dt>
                  <dd>{m.lastActive}</dd>
                </div>
                <div>
                  <dt>Joined</dt>
                  <dd>{m.joinedAt}</dd>
                </div>
              </dl>
              <button
                className="subtle-button"
                aria-label={`Manage ${m.name}`}
                onClick={() => open(m)}
              >
                Manage
                <ArrowUpRight size={15} />
              </button>
            </article>
          ))}
      </div>
      <p className="help-line">
        Removing access never deletes a person record, a contribution or its
        historical attribution.
      </p>
      <dialog
        className="admin-dialog"
        ref={dialog}
        aria-labelledby="manage-member-title"
      >
        <button
          className="dialog-close"
          aria-label="Close member settings"
          onClick={() => dialog.current?.close()}
        >
          <X size={22} />
        </button>
        <p className="eyebrow">ACCESS TO THIS ARCHIVE</p>
        <h2 id="manage-member-title">{selected?.name}</h2>
        <p className="dialog-intro">{selected?.email}</p>
        <RolePicker value={role} onChange={setRole} />
        <PersonSelect value={person} onChange={setPerson} />
        {error && (
          <p className="form-error" role="alert">
            {error}
          </p>
        )}
        <button
          className="button"
          onClick={() => apply({ role, linkedPersonId: person || null })}
        >
          Save member settings
          <Check size={16} />
        </button>
        <section className="member-access-actions">
          <h3>Archive access</h3>
          <p>
            Contributions remain in the archive, with their original
            attribution.
          </p>
          <button
            className="subtle-button"
            onClick={() =>
              apply({
                status: selected?.status === "active" ? "suspended" : "active",
              })
            }
          >
            {selected?.status === "active"
              ? "Suspend access"
              : "Restore access"}
          </button>
          <button
            className="subtle-button danger-text"
            onClick={() => setConfirm(true)}
          >
            Remove access
          </button>
          {confirm && (
            <div className="notice">
              <p>
                Remove {selected?.name}’s access to this archive? Their
                historical contributions will remain.
              </p>
              <div className="small-actions">
                <button onClick={() => apply({ status: "removed" })}>
                  Confirm removal
                </button>
                <button onClick={() => setConfirm(false)}>Keep access</button>
              </div>
            </div>
          )}
        </section>
      </dialog>
    </>
  );
}
