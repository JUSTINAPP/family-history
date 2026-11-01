"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { ArrowUpRight, LockKeyhole } from "lucide-react";
import { useWorkspace } from "../workspace-provider";
import { can, roleOrder, roleDetails } from "@/lib/permissions";
import type { MemberRole } from "@/lib/types";
const links = [
  ["Overview", "/admin"],
  ["Members", "/admin/members"],
  ["Invitations", "/admin/invitations"],
  ["Archive settings", "/admin/settings"],
  ["Processing", "/admin/processing"],
  ["Activity", "/admin/activity"],
];
export function AdminShell({ children }: { children: React.ReactNode }) {
  const path = usePathname();
  const { role, setRole, archive, mode } = useWorkspace();
  const minimum = ["/admin/processing", "/admin/deletions"].includes(path)
    ? "editor"
    : "admin";
  const allowed = can(role, minimum);
  return (
    <div className="admin-shell">
      <header className="admin-masthead">
        <div>
          <p className="eyebrow">
            <LockKeyhole size={12} />
            ARCHIVE ADMINISTRATION
          </p>
          <p className="admin-archive-name">{archive.name}</p>
        </div>
        <Link href="/" className="text-link">
          Return to the archive
          <ArrowUpRight size={16} />
        </Link>
      </header>
      <div className="admin-preview">
        <span>
          {mode === "live"
            ? "Connected archive · access is checked by your membership and database policies."
            : "Local admin preview · authentication and access checks are simulated."}
        </span>
        {mode === "demo" && (
          <label>
            <span>Preview access as</span>
            <select
              aria-label="Preview access as"
              value={role}
              onChange={(e) => setRole(e.target.value as MemberRole)}
            >
              {roleOrder.map((r) => (
                <option value={r} key={r}>
                  {roleDetails[r].title}
                </option>
              ))}
            </select>
          </label>
        )}
        {mode === "live" && <span>Your role: {role}</span>}
      </div>
      <div className="admin-layout">
        <nav className="admin-nav" aria-label="Archive administration">
          {[
            ...links,
            ...(mode === "live" && can(role, "editor")
              ? [
                  [
                    "Deletion progress",
                    `/admin/deletions?archive=${archive.id}`,
                  ],
                ]
              : []),
          ].map(([label, href]) => (
            <Link
              href={href}
              key={href}
              className={path === href ? "selected" : ""}
              aria-current={path === href ? "page" : undefined}
            >
              {label}
              <ArrowUpRight size={14} />
            </Link>
          ))}
          <p>
            People are part of the historical record.
            <br />
            Members have access to the archive.
          </p>
        </nav>
        <div className="admin-content">
          {allowed ? (
            children
          ) : (
            <section className="access-empty">
              <p className="eyebrow">ARCHIVE-SCOPED ACCESS</p>
              <h1>
                {minimum === "editor"
                  ? "A place for editors."
                  : "An admin’s place."}
              </h1>
              <p>
                Your {roleDetails[role].title.toLowerCase()} preview can browse
                the archive
                {can(role, "contributor") ? " and contribute material" : ""}.
                This area requires{" "}
                {minimum === "editor" ? "Editor or Admin" : "Admin"} access to
                this archive.
              </p>
              <p className="help-line">
                Use the preview control above to try another role. It is a demo
                control, not an authentication mechanism.
              </p>
              <Link className="text-link" href="/explore">
                Explore the collection
                <ArrowUpRight size={16} />
              </Link>
            </section>
          )}
        </div>
      </div>
    </div>
  );
}
