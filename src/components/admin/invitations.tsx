"use client";
import { useState } from "react";
import { useWorkspace } from "../workspace-provider";
import { InviteMember } from "./member-management";
import { roleDetails } from "@/lib/permissions";
export function Invitations() {
  const workspace = useWorkspace();
  const [filter, setFilter] = useState("all");
  const [notice, setNotice] = useState("");
  return (
    <>
      <div className="admin-page-heading">
        <div>
          <p className="eyebrow">AN OPEN DOOR, BY INVITATION</p>
          <h1>Invitations.</h1>
          <p>Bring family and trusted helpers into the archive.</p>
        </div>
        <InviteMember />
      </div>
      <div className="filter-tabs" aria-label="Invitation status">
        {["all", "invited", "accepted", "expired", "revoked"].map((f) => (
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
      <div className="invitation-list">
        {workspace.invitations
          .filter((i) => filter === "all" || i.status === filter)
          .map((i) => (
            <article key={i.id} className="invitation-row">
              <div>
                <h2>{i.name}</h2>
                <p>{i.email}</p>
                <small>
                  {roleDetails[i.role].title} · invited{" "}
                  {new Date(i.invitedAt).toLocaleDateString("en-AU", {
                    timeZone: "Australia/Sydney",
                  })}
                </small>
              </div>
              <div>
                <span
                  className={`status-tag ${i.status === "accepted" ? "confirmed" : ""}`}
                >
                  {i.status}
                </span>
                <p className="help-line">
                  {i.status === "invited"
                    ? `Expires ${new Date(i.expiresAt).toLocaleDateString("en-AU", { timeZone: "Australia/Sydney" })}`
                    : "Historical invitation record"}
                </p>
              </div>
              <div className="invitation-actions">
                {i.status === "invited" && (
                  <>
                    <button
                      className="subtle-button"
                      aria-label={`Simulate acceptance for ${i.name}`}
                      onClick={() => {
                        workspace.updateInvitation(i.id, "accept");
                        setNotice(
                          `${i.name} accepted in the demo. A separate membership was created; historical people were not changed.`,
                        );
                      }}
                    >
                      Try acceptance
                    </button>
                    <button
                      className="subtle-button"
                      aria-label={`Revoke invitation for ${i.name}`}
                      onClick={() => {
                        workspace.updateInvitation(i.id, "revoke");
                        setNotice(
                          `Invitation for ${i.name} revoked in this session.`,
                        );
                      }}
                    >
                      Revoke
                    </button>
                  </>
                )}
                {["expired", "revoked"].includes(i.status) && (
                  <button
                    className="subtle-button"
                    disabled={!workspace.settings.invitations}
                    aria-label={`Renew invitation for ${i.name}`}
                    onClick={() => {
                      workspace.updateInvitation(i.id, "resend");
                      setNotice(
                        `A fresh seven-day demo invitation was prepared for ${i.name}. No email sent.`,
                      );
                    }}
                  >
                    Invite again
                  </button>
                )}
              </div>
            </article>
          ))}
      </div>
      <p className="demo-note">
        Demo invitations do not send email or grant real access. Secure,
        expiring, single-use invitations and authentication will be handled by
        the backend, with an audit trail.
      </p>
    </>
  );
}
