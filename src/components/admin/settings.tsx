"use client";
import Link from "next/link";
import { InviteMember } from "./member-management";
import { useState } from "react";
import { Download, Check } from "lucide-react";
import { useWorkspace } from "../workspace-provider";
import { ArchiveImage } from "../ui";
import { roleDetails } from "@/lib/permissions";
import type { ArchivePrivacy, ArchiveSettings } from "@/lib/workspace-types";
import { items, people, places, story } from "@/lib/data";
import { downloadDraft } from "@/lib/capture";
export function Settings() {
  const workspace = useWorkspace();
  const [draft, setDraft] = useState(workspace.archive);
  const [saved, setSaved] = useState(false);
  const [exported, setExported] = useState(false);
  const [error, setError] = useState("");
  return (
    <>
      <div className="admin-page-heading">
        <div>
          <p className="eyebrow">A HOME FOR THIS HISTORY</p>
          <h1>Archive settings.</h1>
          <p>The name on the door, and the way we care for what’s inside.</p>
        </div>
      </div>
      <form
        className="archive-settings"
        onSubmit={async (e) => {
          e.preventDefault();
          const result = await workspace.saveArchive(draft);
          setError(result || "");
          setSaved(!result);
        }}
      >
        <section className="settings-section">
          <h2>The archive</h2>
          <div>
            <label className="field">
              <span>Archive name</span>
              <input
                value={draft.name}
                onChange={(e) => {
                  setSaved(false);
                  setDraft({ ...draft, name: e.target.value });
                }}
                required
                pattern=".*\S.*"
                maxLength={120}
              />
            </label>
            <label className="field">
              <span>Archive slug</span>
              <input
                aria-label="Archive slug"
                aria-describedby="archive-slug-help"
                value={draft.slug}
                onChange={(e) => {
                  setSaved(false);
                  setDraft({ ...draft, slug: e.target.value });
                }}
                required
                pattern="[a-z0-9]+(-[a-z0-9]+)*"
                maxLength={80}
              />
              <p className="field-hint" id="archive-slug-help">
                The future archive address. Renaming does not change this slug
                or its ID. URLs in this single-archive demo remain unchanged.
              </p>
            </label>
            <label className="field">
              <span>Description</span>
              <textarea
                value={draft.description}
                onChange={(e) => {
                  setSaved(false);
                  setDraft({ ...draft, description: e.target.value });
                }}
                maxLength={1500}
              />
            </label>
            <label className="field">
              <span>Cover image</span>
              <select
                value={draft.coverImage}
                onChange={(e) =>
                  setDraft({ ...draft, coverImage: e.target.value })
                }
              >
                <option value="/images/beach.jpg">A day at the beach</option>
                <option value="/images/picnic.jpg">Sunday, together</option>
                <option value="/images/garden.jpg">In the garden</option>
              </select>
            </label>
            <ArchiveImage
              src={draft.coverImage}
              alt="Selected archive cover"
              className="settings-cover"
            />
          </div>
        </section>
        <section className="settings-section">
          <h2>Private by invitation</h2>
          <div>
            <label className="field">
              <span>Privacy</span>
              <select
                aria-label="Privacy"
                aria-describedby="archive-privacy-help"
                value={draft.privacy}
                onChange={(e) => {
                  setSaved(false);
                  setDraft({
                    ...draft,
                    privacy: e.target.value as ArchivePrivacy,
                  });
                }}
              >
                <option value="members_only">Invited members only</option>
                <option value="owner_only">Only the owner</option>
              </select>
              <p className="field-hint" id="archive-privacy-help">
                Both modes are private. Owner-only access keeps memberships and
                historical contributions intact.
              </p>
            </label>
            <p className="prose">
              The connected archive will check privacy and membership before
              showing material. Public sharing is not available.
            </p>
            <p className="demo-note">
              Privacy is a design setting in this prototype. There is no sign-in
              or server enforcement yet.
            </p>
            <label className="settings-check">
              <input
                type="checkbox"
                checked={draft.settings.invitations}
                onChange={(e) =>
                  setDraft({
                    ...draft,
                    settings: {
                      ...draft.settings,
                      invitations: e.target.checked,
                    },
                  })
                }
              />
              <div>
                <strong>Allow member invitations</strong>
                <p>
                  Admins can invite trusted people. Pausing invitations does not
                  remove current members.
                </p>
              </div>
            </label>
            <label className="field">
              <span>Default permissions for new members</span>
              <select
                aria-label="Default permissions for new members"
                aria-describedby="archive-default-help"
                value={draft.settings.defaultRole}
                onChange={(e) =>
                  setDraft({
                    ...draft,
                    settings: {
                      ...draft.settings,
                      defaultRole: e.target
                        .value as ArchiveSettings["defaultRole"],
                    },
                  })
                }
              >
                {(["viewer", "commenter", "contributor"] as const).map((r) => (
                  <option value={r} key={r}>
                    {roleDetails[r].title}
                  </option>
                ))}
              </select>
              <p className="field-hint" id="archive-default-help">
                Admins can choose another role per invitation. Contributors can
                describe their own material, never silently verify historical
                facts.
              </p>
            </label>
          </div>
        </section>
        <section className="settings-section">
          <h2>A little assistance</h2>
          <div>
            {[
              {
                key: "ai" as const,
                title: "AI interpretation",
                copy: "Propose people, dates, places and classifications for human review.",
              },
              {
                key: "transcription" as const,
                title: "Handwriting transcription",
                copy: "Create raw machine text and a separate reviewed version.",
              },
              {
                key: "locations" as const,
                title: "Location suggestions",
                copy: "Suggest places from context. Never rewrite an accepted location.",
              },
            ].map((setting) => (
              <label className="settings-check" key={setting.key}>
                <input
                  type="checkbox"
                  checked={draft.settings[setting.key]}
                  onChange={(e) =>
                    setDraft({
                      ...draft,
                      settings: {
                        ...draft.settings,
                        [setting.key]: e.target.checked,
                      },
                    })
                  }
                />
                <div>
                  <strong>{setting.title}</strong>
                  <p>{setting.copy}</p>
                </div>
              </label>
            ))}
            <p className="help-line">
              Preference preview only. No AI service is connected, and these
              switches do not send files anywhere.
            </p>
          </div>
        </section>
        <section className="settings-section">
          <h2>Ownership</h2>
          <div>
            <p className="help-line" style={{ margin: "0 0 20px" }}>
              Created{" "}
              {new Date(draft.createdAt).toLocaleDateString("en-AU", {
                timeZone: "Australia/Sydney",
                day: "numeric",
                month: "long",
                year: "numeric",
              })}{" "}
              · Archive ID: {draft.id}
            </p>
            <label className="field">
              <span>Archive owner</span>
              <select
                value={draft.ownerMembershipId}
                onChange={(e) =>
                  setDraft({ ...draft, ownerMembershipId: e.target.value })
                }
              >
                {workspace.members
                  .filter((m) => m.role === "admin" && m.status === "active")
                  .map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.name}
                    </option>
                  ))}
              </select>
              <p className="field-hint">
                Ownership can only move to an active admin. Promote a trusted
                member first. The connected system will require a separate
                secure transfer and acceptance.
              </p>
            </label>
          </div>
        </section>
        {error && (
          <p className="form-error" role="alert">
            {error}
          </p>
        )}
        <div className="settings-save">
          <button type="submit" className="button">
            Save archive settings
            <Check size={17} />
          </button>
          {saved && <p role="status">Settings saved in this demo session.</p>}
        </div>
      </form>
      <section className="settings-section">
        <h2>Archive members</h2>
        <div>
          <p className="prose">
            {workspace.members.filter((m) => m.status === "active").length}{" "}
            active members. Manage each person’s access to this archive;
            historical Person records remain separate.
          </p>
          <div className="archive-member-settings-actions">
            <Link className="text-link" href="/admin/members">
              Manage archive members ↗
            </Link>
            <InviteMember />
          </div>
        </div>
      </section>
      <section className="settings-section">
        <h2>Yours to keep</h2>
        <div>
          <p className="prose">
            Your archive should be able to leave with you: originals, audio
            recollections, metadata, relationships, reviewed text and
            provenance.
          </p>
          <button
            className="button button-light"
            style={{ marginTop: 20 }}
            onClick={() => {
              downloadDraft({
                formatVersion: 1,
                scope: "local_demo_metadata_only",
                archive: workspace.archive,
                illustrativeCatalogue: {
                  items,
                  people,
                  places,
                  stories: [story],
                },
                members: workspace.members,
                invitations: workspace.invitations,
                captures: workspace.captures.map((i) => ({
                  ...i,
                  files: i.files.map((f) => ({
                    id: f.id,
                    name: f.originalName,
                    role: f.role,
                    size: f.file.size,
                    mimeType: f.file.type,
                  })),
                })),
                reviewedTranscriptions: workspace.reviewedText,
                activity: workspace.activity,
                exclusions: [
                  "Original image bytes",
                  "Original audio bytes",
                  "A real storage backup",
                ],
                disclaimer:
                  "This is not a complete archive backup. No server storage is connected.",
              });
              setExported(true);
            }}
          >
            <Download size={17} />
            Export entire archive · concept
          </button>
          <p className="help-line">
            The demo downloads a metadata manifest only. A real full export will
            include original image/audio files, checksums and a readable
            inventory. It is not implemented yet.
          </p>
          {exported && (
            <p className="notice" role="status">
              Demo metadata manifest exported. Original files and audio are not
              included; this is not a complete backup.
            </p>
          )}
        </div>
      </section>
    </>
  );
}
