"use client";
import Link from "next/link";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { useWorkspace } from "../workspace-provider";
import { MemberManagement } from "../admin/member-management";
import { saveArchiveAction } from "@/lib/backend/actions";
export function LiveAdmin({ section = "overview" }: { section?: string }) {
  const workspace = useWorkspace();
  const [draft, setDraft] = useState(workspace.archive);
  const [notice, setNotice] = useState("");
  const [busy, setBusy] = useState(false);
  const router = useRouter();
  if (section === "members") return <MemberManagement />;
  if (section === "settings")
    return (
      <>
        <div className="admin-page-heading">
          <div>
            <p className="eyebrow">CONNECTED ARCHIVE</p>
            <h1>Archive settings.</h1>
            <p>
              Saved to this archive, with database-enforced Admin permissions.
            </p>
          </div>
        </div>
        <form
          className="archive-settings"
          onSubmit={async (e) => {
            e.preventDefault();
            setBusy(true);
            const error = await saveArchiveAction(draft);
            setNotice(error || "Archive settings saved.");
            setBusy(false);
            if (!error) router.refresh();
          }}
        >
          <label className="field">
            <span>Archive name</span>
            <input
              value={draft.name}
              required
              maxLength={120}
              onChange={(e) => setDraft({ ...draft, name: e.target.value })}
            />
          </label>
          <label className="field">
            <span>Archive slug</span>
            <input
              value={draft.slug}
              required
              pattern="[a-z0-9]+(-[a-z0-9]+)*"
              maxLength={80}
              onChange={(e) => setDraft({ ...draft, slug: e.target.value })}
            />
          </label>
          <label className="field">
            <span>Description</span>
            <textarea
              value={draft.description}
              maxLength={1500}
              onChange={(e) =>
                setDraft({ ...draft, description: e.target.value })
              }
            />
          </label>
          <label className="field">
            <span>Privacy</span>
            <select
              value={draft.privacy}
              onChange={(e) =>
                setDraft({
                  ...draft,
                  privacy: e.target.value as "owner_only" | "members_only",
                })
              }
            >
              <option value="members_only">Invited members only</option>
              <option value="owner_only">Only the owner</option>
            </select>
          </label>
          <label className="field">
            <span>Default permissions for future invitations</span>
            <select
              value={draft.settings.defaultRole}
              onChange={(e) =>
                setDraft({
                  ...draft,
                  settings: {
                    ...draft.settings,
                    defaultRole: e.target.value as
                      "viewer" | "commenter" | "contributor",
                  },
                })
              }
            >
              <option value="viewer">Viewer</option>
              <option value="commenter">Commenter</option>
              <option value="contributor">Contributor</option>
            </select>
          </label>
          <p className="demo-note">
            AI processing, cover selection, ownership transfer, full backup
            export and email invitations are not operational in this backend
            stage. Originals and existing attribution are retained.
          </p>
          {notice && (
            <p className="notice" role="status">
              {notice}
            </p>
          )}
          <button className="button" disabled={busy}>
            {busy ? "Saving…" : "Save archive settings"}
          </button>
        </form>
        <div style={{ marginTop: 30 }}>
          <Link className="text-link" href="/admin/members">
            Manage archive members ↗
          </Link>
        </div>
      </>
    );
  if (section === "invitations")
    return (
      <>
        <div className="admin-page-heading">
          <div>
            <p className="eyebrow">INVITE SOMEONE</p>
            <h1>Invitations.</h1>
            <p>
              Invite someone to join the shared archive using their own email and password.
            </p>
          </div>
        </div>
        <p className="notice">
          Create an invitation link for their email address, then share it by email or message. Links expire after seven days.
        </p>
        <Link className="button" href="/invite">Invite someone</Link>
      </>
    );
  if (section === "activity")
    return (
      <>
        <div className="admin-page-heading">
          <h1>Activity.</h1>
        </div>
        <ol className="archive-activity">
          {workspace.activity.map((a) => (
            <li key={a.id}>
              <time>
                {new Date(a.at).toLocaleDateString("en-AU", {
                  timeZone: "Australia/Sydney",
                })}
              </time>
              <p>
                {a.actor} · {a.action}
              </p>
            </li>
          ))}
        </ol>
        {!workspace.activity.length && (
          <p className="notice">No activity yet.</p>
        )}
      </>
    );
  if (section === "processing")
    return (
      <>
        <div className="admin-page-heading">
          <div>
            <p className="eyebrow">DURABLE JOB RECORDS</p>
            <h1>Processing.</h1>
          </div>
        </div>
        <p className="demo-note">
          Display generation is queued after source receipt. No worker or AI
          provider is connected, so jobs do not pretend to complete.
        </p>
        <div className="job-list">
          {workspace.jobs.map((j) => (
            <article className="job-row" key={j.id}>
              <div>
                <h2>{j.title}</h2>
                <p>{j.stage}</p>
              </div>
              <span className="status-tag">{j.status}</span>
              <Link className="text-link" href={j.href}>
                Inspect item ↗
              </Link>
            </article>
          ))}
        </div>
      </>
    );
  return (
    <>
      <div className="admin-page-heading">
        <div>
          <p className="eyebrow">YOUR CONNECTED ARCHIVE</p>
          <h1>The archive, together.</h1>
          <p>{workspace.archive.description}</p>
        </div>
      </div>
      <div className="admin-editorial-links">
        {[
          ["Members", `${workspace.members.length} memberships`, "members"],
          [
            "Archive settings",
            "Name, privacy and default permissions",
            "settings",
          ],
          [
            "Processing",
            `${workspace.jobs.length} durable job records`,
            "processing",
          ],
          ["Activity", "Contributions and source receipts", "activity"],
        ].map(([title, copy, href]) => (
          <Link key={href} href={`/admin/${href}`}>
            <div>
              <h2>{title}</h2>
              <p>{copy}</p>
            </div>
            <span>↗</span>
          </Link>
        ))}
      </div>
      <p className="notice">
        Connected to Supabase with your authenticated session. No fictional
        records are seeded. AI and email invitations remain off.
      </p>
    </>
  );
}
