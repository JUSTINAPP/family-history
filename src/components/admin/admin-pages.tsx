"use client";
import Link from "next/link";
import { ArrowUpRight } from "lucide-react";
import { useWorkspace } from "../workspace-provider";
import { ArchiveImage } from "../ui";
import { InviteMember, MemberManagement } from "./member-management";
import { Invitations } from "./invitations";
import { Settings } from "./settings";
import { Processing } from "./processing";
export function ActivityView({ compact = false }: { compact?: boolean }) {
  const { activity } = useWorkspace();
  return (
    <>
      {!compact && (
        <div className="admin-page-heading">
          <div>
            <p className="eyebrow">THE RECORD OF THE RECORD</p>
            <h1>Activity.</h1>
            <p>
              Who contributed, what was suggested, and how a detail became part
              of the archive.
            </p>
          </div>
        </div>
      )}
      <ol className="archive-activity">
        {activity.slice(0, compact ? 4 : undefined).map((entry) => (
          <li key={entry.id}>
            <div>
              <time dateTime={entry.at}>
                {new Date(entry.at).toLocaleDateString("en-AU", {
                  timeZone: "Australia/Sydney",
                  day: "numeric",
                  month: "short",
                })}
              </time>
              <span
                className={`status-tag ${entry.layer === "review" ? "confirmed" : entry.layer === "suggestion" ? "uncertain" : ""}`}
              >
                {entry.layer}
              </span>
            </div>
            <p>
              <strong>{entry.actor}</strong> {entry.action}
              {entry.itemId && !entry.itemId.includes(":page:") && (
                <Link
                  href={`/add/saved/${entry.itemId}`}
                  className="activity-source"
                >
                  Source item ↗
                </Link>
              )}
            </p>
          </li>
        ))}
      </ol>
      <p className="help-line">
        Initial entries are fictional examples. New changes are recorded for
        this session. This is provenance, not a social feed.
      </p>
    </>
  );
}
function Overview() {
  const workspace = useWorkspace();
  return (
    <>
      <div className="admin-page-heading">
        <div>
          <p className="eyebrow">CARE FOR WHAT WE KEEP</p>
          <h1>The archive, together.</h1>
          <p>
            A little stewardship keeps the stories open for the people who
            matter.
          </p>
        </div>
      </div>
      <div className="admin-overview-feature">
        <ArchiveImage
          src={workspace.archive.coverImage}
          alt="Archive cover from the demo collection"
        />
        <div>
          <span className="eyebrow">YOUR PRIVATE ARCHIVE · CONCEPT</span>
          <h2>{workspace.archive.name}</h2>
          <p>{workspace.archive.description}</p>
          <span className="status-tag">
            {workspace.archive.privacy === "owner_only"
              ? "Owner only · privacy mocked"
              : "Invited members only · privacy mocked"}
          </span>
        </div>
      </div>
      <div className="admin-editorial-links">
        {[
          [
            "Members",
            `${workspace.members.filter((m) => m.status === "active").length} people with access`,
            "/admin/members",
          ],
          [
            "Invitations",
            `${workspace.invitations.filter((i) => i.status === "invited").length} awaiting a reply`,
            "/admin/invitations",
          ],
          [
            "Processing",
            `${workspace.captures.length} items captured this session`,
            "/admin/processing",
          ],
          [
            "Archive settings",
            "A name, a home, a way to keep it safe",
            "/admin/settings",
          ],
        ].map(([title, copy, href]) => (
          <Link key={href} href={href}>
            <div>
              <h2>{title}</h2>
              <p>{copy}</p>
            </div>
            <ArrowUpRight size={22} />
          </Link>
        ))}
      </div>
      <div className="admin-invite-note">
        <div>
          <h2>There’s room for another voice.</h2>
          <p>Invite someone to look, remember, or contribute.</p>
        </div>
        <InviteMember />
      </div>
      <div className="admin-section-heading">
        <h2>A trace of the work.</h2>
        <Link className="text-link" href="/admin/activity">
          All activity
          <ArrowUpRight size={15} />
        </Link>
      </div>
      <ActivityView compact />
    </>
  );
}
export function AdminPage({ section = "overview" }: { section?: string }) {
  return section === "members" ? (
    <MemberManagement />
  ) : section === "invitations" ? (
    <Invitations />
  ) : section === "settings" ? (
    <Settings />
  ) : section === "processing" ? (
    <Processing />
  ) : section === "activity" ? (
    <ActivityView />
  ) : (
    <Overview />
  );
}
