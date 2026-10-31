# Archive permissions

**Current follow-up:** The live archive has been created (confirmed by the user). Private HEIC display previews, real bulk import and catalogue editing are now implemented locally. Apply **only migration 005** to the existing project; do not rerun first-install SQL. See [preview, bulk and cataloguing setup](preview-bulk-cataloguing.md) for current behaviour, deployment and limits. Earlier foundation status below is historical where it says the hosted schema is absent or bulk/preview processing is deferred.

## Enforced foundation (current)

In real mode, the database is the permission authority: private-schema SECURITY DEFINER helpers resolve active membership and privacy, and RLS filters archive tables/Storage. Sensitive records have no direct authenticated INSERT/UPDATE/DELETE grants; reviewed public RPCs check roles and stamp auth.uid(). Viewer reads; Commenter may add recollections/comments/identification proposals; Contributor may reserve/upload/finalise own source items; Editor may create people/update catalogue/review transcription; Admin may update archive settings and existing memberships. owner_only additionally restricts access to the owner's membership. Owner demotion/suspension/removal is rejected inside a serialised membership transaction.

The original preview-role selector appears only in explicit demo mode. Real admin routes also check membership server-side and real role changes use manage_member. API routes independently check Auth/RLS. Public client credentials do not grant database administration or bypass RLS; no service-role key is used. Raw SQL/provider errors are not shown to users.

These policies are implemented in migrations and passed local PostgreSQL checks; they are NOT yet installed remotely. Apply and verify them before using private material. Email invitation delivery/redemption, ownership transfer and archive-wide destructive deletion remain disabled. The earlier UI-only descriptions below describe the retained demo/roadmap, not real-mode authorisation.

## Implemented UI / mocked enforcement

The demo uses one selected Archive in `WorkspaceProvider`, initially The Allen & Cork Archive. The Archive record is separate from account identity and settings. Members and invitations carry archive UUIDs; captures also carry archive and contributor UUIDs. The preview role is the role for this selected archive, not a property of a historical person or a global profile. The profile menu and mobile menu lead to `/admin`.

An explicit **Preview access as** selector lets you evaluate Viewer, Commenter, Contributor, Editor and Admin. Client checks gate capture/bulk at Contributor, comparison-review writes at Editor, processing inspection at Editor, and membership/settings/activity administration at Admin. Mutating context methods repeat these checks. The archive owner cannot be suspended, removed or demoted until ownership is transferred, and the last active admin is protected. Role changes never delete history.

These checks demonstrate UX. They provide **no real confidentiality or authorisation**: the app has no sign-in, and all demo assets/fixtures are public. Do not add private records until Supabase access control is implemented. A role selector would never be an authority source in production.

## Role contract

Roles are cumulative and belong to `(archive_id, profile_id)` membership.

| Role        | Capabilities                                                                                                                                                                                                              |
| ----------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Viewer      | Browse, search, view people, places, stories and tree.                                                                                                                                                                    |
| Commenter   | Viewer plus comments, proposed identifications and recollections on existing material.                                                                                                                                    |
| Contributor | Commenter plus create/upload items, source audio and files; describe own unverified contributions.                                                                                                                        |
| Editor      | Contributor plus edit catalogue, verify identities with evidence, correct transcription, manage people/relationships, approve suggestions, curate collections and stories. Can inspect/review processing attention items. |
| Admin       | Editor plus invite/suspend/remove members, manage roles, settings, ownership, integrations and archive-wide processing configuration.                                                                                     |

The current UI does not implement every permissioned feature (for example people editing, identity-verification workflows, actual integrations and recollections on existing items remain future work). The role descriptions state the backend contract, not a claim that those tools already exist.

One profile may be Admin in an Allen archive, Viewer in a Smith archive and Contributor in a local-history archive. Selecting a historical Person never changes a permission. A membership may optionally link to the same person's historical record **in that archive**. Most ancestors have no account, and researchers may have an account without a Person. Link only when identity is known; do not auto-link matching names or email addresses. Revoking access retains contributed_by/source attributions and the Person record.

## Future backend enforcement

Every archive-owned table enables/FORCEs RLS. Policy predicates check active, nonsuspended membership using `auth.uid()`. Use archive-scoped composite foreign keys, immutable archive_id columns and restricted column/RPC writes. Contributor updates are limited to their own unverified drafts; clients cannot change owner/contributor identity, approved metadata, raw output or provenance. Verification is an editor operation with an evidence reference, not a confidence threshold. Service workers can create derivatives, pending interpretations and processing states but cannot mark historical facts verified.

Invitation endpoints require Admin membership and invitation settings to allow new invites. Pending invitation records do not grant access. An accepted Auth session with a verified email must redeem a single-use, expiring, hashed-token invitation inside a transaction; recheck role, archive, expiry, revocation and email. Bind membership to the verified profile UUID, enforce unique (archive_id, profile_id), and consume the invite atomically. Use Supabase invite/magic-link flows through a trusted server. Never ask admins to create passwords; never store plaintext tokens in the database or log them. Reissuing invalidates the old token.

Suspension/revocation invalidates backend access even if the browser still has an unexpired auth token. Storage access and signed-URL generation must check current membership. Signed URLs remain bearer capabilities until expiration: keep expiry short and account for this during revocation. Ownership transfer requires current owner intent, a target active admin, secure acceptance and an audit record; final-admin changes must serialize to prevent races. Soft removal of membership preserves attribution and archive evidence.

Test anonymous reads, two-archive isolation, every role/write path, forged archive IDs, disabled/suspended memberships, signed-file access, invitation races/expiry/email mismatch/reuse, owner transfer and concurrent last-admin removal before production.

## Private modes and defaults

Privacy is archive-scoped: Invited members only (`members_only`) uses active membership and that archive’s role; Only the owner (`owner_only`) additionally restricts historical access to the owner’s active membership. Neither mode is public. Memberships and provenance are retained when the owner narrows privacy. The switcher’s accessible-archive helper applies this distinction, but real content confidentiality still requires backend RLS and private Storage. The single-archive prototype does not enforce security on public demo fixtures.

Default permissions initialise a **new invitation’s** role, not a profile-wide role and not a bulk update of existing members. Ownership references an active Admin membership in the same archive. A profile can own multiple archives and be a Viewer elsewhere. Linked historical Person records remain optional and archive-local.

## Preview/catalogue follow-up (005)

`catalogue_item` permits active Contributors to describe their own unverified items and Editors/Admins to describe any accessible ready item. Verified records require an Editor; changing catalogue assertions returns them to reported status. Viewers/Commenters cannot edit catalogue fields. `reserve_display` / `complete_display` permit Editors or the original active Contributor to prepare/recover derived previews. Reserved derived bytes can be read by that actor or an Editor for safe retry; this does not widen original-file reads. Storage has no ordinary client UPDATE/DELETE policy. Recollections and identification suggestions retain their separate Commenter minimum.
