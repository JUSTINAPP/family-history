# Product architecture — private archives on a shared platform

## Persistent foundation update

Real mode now uses authenticated Supabase sessions and archive-scoped database queries/RPCs for source items, written recollections, archives, people and membership changes. Historical fixtures remain only in explicit demo mode. Remote migrations must still be applied; see supabase-setup.md. The prototype interaction descriptions below refer to that retained demo where a service is not yet connected. No AI or invitation delivery is operational in real mode.

## Implemented UI

The established gallery/editorial archive remains the discovery experience. The capture studio is deliberately quieter and simpler: take/upload → large source preview → voice/text recollection → optional quick details/suggestion review → Save & next or Save & view. Rapid mode attempts to reopen the camera from the Save & next user gesture; browser behaviour varies. Letters group ordered pages and envelopes. Objects group Front, Back, Detail, Inscription and Other view. Postcards, certificates, artwork and documents use the same context-first approach.

The administration area supplies Overview, Members, Invitations, Archive settings, Processing and Activity. Its typography, paper, thin rules and editorial rows extend the existing visual system. There is no billing/organisation/enterprise UI. `/admin` is discoverable from the profile menu, mobile navigation and footer.

## Mocked functionality

A root session provider retains captures, source File handles, original audio references, recollections, interpretation choices, review versions, memberships, invitations, settings and activity across internal navigation. Reloading clears the session. No browser-local persistence is implied. URLs for selected files live until provider teardown so saved previews survive navigation; no source bytes are transformed. Bulk review also creates captures in the same session queue.

Voice uses an 8.6-second locally generated spoken example, explicitly labelled. The microphone is never opened. Record/pause/continue/finish/play/re-record/transcribe/edit demonstrate the future flow. The machine transcript and edited words remain separate; the audio stays attached. A small deterministic recogniser provides **demo** person/year/place suggestions from entered words, not an actual AI service. Confirmation means contributor confirmation of recollection, not historical verification.

Invitations create local rows, with mock acceptance, renew and revoke actions. No mail is sent. Role selection is a UX preview. Setting privacy to Members only does not make this prototype private. Export is a JSON manifest without image/audio bytes and is not a backup.

## Future platform boundary

```
Auth user / profile
    → active archive membership (role belongs here)
        → archive (owns historical data)
            → people / items / places / events / relationships
            → recollections / source files / reviewed text
            → collections / stories / provenance
```

An archive’s name and subject are content, not a database namespace. A user can create and join multiple archives with one account; the selected archive provides the tenant context. Use one membership per archive/profile, invitations scoped to the archive, and optional membership-to-person linkage in that archive. A Person is never a login requirement or permission authority. Keep service repositories parameterised by archive UUID; enforce it through RLS, foreign keys and server authorization, not path text alone.

A restrained archive switcher lives in the header’s current-archive name. It currently lists only The Allen & Cork Archive, its role and links to archive home/settings. It can enumerate accessible archive memberships later; there are no invented extra archives or archive-provisioning screens in this demo. Billing, enterprise roles and provisioning remain out of scope. `WorkspaceProvider` is a replaceable client-state adapter, not the future security boundary. Future repository/API modules replace its in-memory mutations without forcing a redesign of capture or administration.

## The layers of the historical record

| Layer                  | Contains                                                                              | Authority                                                     |
| ---------------------- | ------------------------------------------------------------------------------------- | ------------------------------------------------------------- |
| Capture / original     | Untouched image/scan/letter pages/object views/audio bytes                            | Primary material; immutable after verified receipt.           |
| Human context          | Contributor, original written/voice recollection, reported identity/date/place        | Family knowledge; preserve wording and uncertainty.           |
| Machine interpretation | OCR, speech/handwriting transcription, candidate people/place/date/type/relationships | Derived suggestions with model/run/source references.         |
| Review / archive       | Editor-reviewed transcription and source-backed canonical assertions                  | Explicit review/provenance; never erase raw output or source. |

An ordinary capture can exist with almost no metadata. Make it available after durable original receipt and queue other work independently. Processing is not a compulsory wizard step. Search/discovery can surface “uncatalogued” and “needs review” material without fabricating titles, dates or identities.

## Portability

A real export should include immutable original images/audio, derived files if requested, readable metadata, UUID relationships, collections/story citations, raw/reviewed transcriptions, provenance, checksums and a format-versioned manifest. Run exports asynchronously, check archive permissions, use expiring download access and provide progress/retry. Database backups and object backups are separate. Test restoration into an independent archive; do not lock family history to vendor-specific identifiers or generated narratives.

## Archive is the top-level concept

The initial archive is **The Allen & Cork Archive**, slug `the-allen-and-cork-archive`. The platform is about Archives, not a required family category or family-tree root. Names are chosen by the owner: The Allen & Cork Archive, Our Wedding, Janice Allen, Kodaikanal Years, Family Letters, A property history, or An artist archive are all valid subjects. Do not require the words “family” or “archive” in a name. Historical people, family relationships and categories remain useful content within some archives, not platform ownership rules.

An `Archive` has UUID identity, name, slug, description, cover image, owner membership, created date, privacy and settings. Members, member permissions, items, people, places, collections and stories are related **through archive_id**, rather than being embedded in a global user record. The TypeScript `Archive` separates identity from `ArchiveSettings` (processing preferences, invitation defaults and policy). Renaming is a metadata edit; it does not replace the UUID, automatically change the slug or move any source file. Slugs are globally unique human-readable locators, never authority or foreign keys.

Admin → Archive settings changes the name, description, cover, slug, privacy, invitation default and processing preferences. It links directly to member/role management and provides invitation creation. Ownership and created date are visible; created date is immutable. Default permissions initialise new invitations and never rewrite existing memberships. Both privacy modes are private: **Invited members only**, or **Only the owner**. Owner-only access preserves memberships and contributions; future server policies restrict access until the owner allows members again. These modes are explicitly previews until Auth/RLS exist.

The interface shows the archive name in the header and relevant administration context. It does not repeat the full name in every page heading or rebrand the editorial content. Settings changes update the session’s shared Archive record across internal navigation. The footer/product language uses Archive; the family-specific stories are this archive’s replaceable example material.

One global profile may hold different memberships:

```
Jonas (one profile)
  → The Allen & Cork Archive — Admin / owner
  → Our Wedding — Admin / owner
  → Another Family Archive — Viewer
```

There is no global Admin flag on the profile. The member record remains separate from any optionally linked historical Person. A person may appear independently in several archives; cross-archive identity matching/merging is never assumed.

### Current adapter and future switching

`WorkspaceProvider` tracks an active archive UUID, stores Archive records separately, filters session members/invitations/captures/jobs/activity by archive_id, and keys reviewed text and preview roles by archive UUID. Mutations stamp/check the active archive instead of importing a family-specific singleton ID. Background capture jobs retain their own archive ID. `accessibleArchives` resolves active profile membership plus privacy, and `archiveMembership` resolves that archive’s role; the switcher only selects an accessible archive.

Only one archive is provisioned. Creating another archive and loading its historical catalogue are **future backend** work. Existing server-rendered public demo routes still use this archive’s fixtures, which now explicitly carry archiveId. Do not expose multiple real archives merely by adding names to the switcher: first replace fixture imports with repositories queried by the authorised active archive UUID and introduce archive-qualified routes, for example `/a/:archiveSlug/explore`. Clear/cancel prior archive requests and private caches on switch; key query caches, subscriptions, drafts and review state by archive UUID. Prevent an unsaved capture from being silently lost and recheck current membership on the server.

The client adapter resets page-local UI when the active archive ID changes, while saved session data remains scoped. This is UX preparation, not a security boundary. Server metadata currently uses the initial archive identity; session renames update the visible archive controls. A backend implementation must resolve page metadata from the authorised archive as well.
