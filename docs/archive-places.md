# Archive Places — release 011

Base commit: `40eac12`. Places are now archive-scoped records and entry points into their actual linked material. The explicit visual demo remains separate. This release was implemented and tested locally; no production project was queried or changed and nothing was staged, committed, pushed or deployed by the agent. Migrations 001–010 are unchanged. Only `202611010011_archive_places.sql` is new.

## Data model and permissions

`places` stores UUID, archive ID, name, optional locality/suburb, city, region/state, country, optional bounded latitude/longitude, notes, original creator/time and updated time. Only a name is required. Meaningful family locations are valid; there is no geographic directory, global name uniqueness, geocoding, mapping dependency or external API call. Separate archives can independently contain a Place with the same name.

`item_places` is the canonical many-to-many relationship. It stores archive/item/Place IDs, role, reported/confirmed/removed status, human/explicit-legacy source, a snapshot of reported Where wording, creator/time and reviewer/time. Composite foreign keys enforce same-archive item and Place ownership. One active primary Place per item keeps the initial interface simple; additional written_in, sent_to, depicted and related roles are already supported by the schema/RPC for richer future contexts. No residence or journey is inferred.

Both new tables have ENABLE/FORCE RLS, membership/item-readability policies, SELECT-only authenticated table grants and narrow security-definer mutation RPCs. Private helper execution is revoked from ordinary clients. Existing policies are not widened.

| Role | Permissions |
| --- | --- |
| Viewer / Commenter | Read archive-scoped Places and readable item associations; no Place mutation |
| Contributor | Link an existing Place or create/link a minimal Place atomically on their own ready, unverified, active item; retract/change their own unconfirmed primary report |
| Editor / Admin | Create/edit directory records; link/reconcile Places on readable ready items; confirm, replace or remove associations |

A Contributor cannot replace an Editor-confirmed or another account's primary report; the picker directs them to Editor review. General directory editing remains Editor-only. Removing/replacing a link retains the old association and its reported wording as history; it never deletes the Place. Inline creation rolls back the new Place if association creation fails. Place create/edit and association operations append provenance; original item metadata/provenance remains intact.

## Experience

The live `/places` page keeps **A sense of place.** and offers **Add a place** to Editors. The creation dialog asks for a name, with optional geographic/context fields under More about this place. Editing is available on Place detail. Duplicate merging and Place-record deletion are not implemented in this release.

Place cards reuse the People material pile: deterministic confirmed-first, photograph-preferred, source-diverse selection of up to four real active linked items with completed image sets. One image is displayed once; empty Places use a restrained placeholder; linked items without a ready image set show previews pending. Cards use only the maximum-600px small WebP, stored LQIP, natural source ratios and below-fold native lazy loading. They never fetch an original, choose a display master or initiate conversion. Card prefetch is disabled.

Item detail and its catalogue editor have a **Where** section with an archive-scoped searchable Place picker, primary location, View place, minimal inline creation and permitted confirmation/removal controls. Matching searches name and locality context. Selecting a Place writes a UUID relationship, not a location string. Catalogue editing preserves the old free-text field under **Original Where wording → Reported Where notes (text)**; this remains evidence, not canonical identity.

Where text is never automatically converted or discarded. Editors can explicitly choose **Link to existing place** or **Create place from reported text**, review/select the intended record and retain the original wording separately. Link provenance captures the wording at that decision and the source item's contributor ID; it does not falsely assert that the item contributor authored every later metadata edit. Existing catalogue-edit provenance continues to record such edits. Confirmation remains a separate Editor action.

Place detail groups real photographs, letters/documents, other linked material and actual reported dates. People are drawn from active Person links on those same items, with the explicit heading **People appearing in material connected to this place** and a warning that the connection does not establish residence. No empty/fake Stories section or map/journey feature is introduced. Names in text never establish a Place or Person connection.

Explore's live Place selector uses Place UUIDs and active `item_places` relationships. General text search can still find original Where wording and linked Place names; it is separate from structured filtering. A removed relationship does not reappear in the Place filter just because the item's original wording still contains that name. Failed Place reads produce an unavailable state when filtering, rather than a false complete empty result.

## Retrieval, security and lifecycle

Request-local cached, paginated Place-directory and association reads are shared within a render. Directory/Explore pages load active associations in batches; item detail loads that item's history. The existing batched catalogue/image-set/Person snapshot supplies cards and connected People without per-Place or per-Person item queries. The layout uses the lightweight material-page shell for Places; there is no automatic hydration workspace refetch. New indexes support archive/name, active Place material, item history and cascade cleanup.

A local production browser scenario with 33 Places and more than 127 links verifies one Places query, two paginated association queries, one archive read and one membership read. Counts scale with result pages, not a query chain per card. Private image delivery, conditional ETag authorization, responsive hierarchy and original download protection are unchanged. Place query/render labels are added to the existing development-only diagnostics; no new production diagnostic UI is exposed.

The 009 lifecycle guard now also protects new `item_places` inserts/updates. Split RPCs are unchanged: shared Place links stay on the archived parent alongside shared context; children start without inherited Place claims. Each child can be linked deliberately.

Migration 011 replaces only the deletion **preflight** function to recognize this reviewed child relationship and also inspect future dependencies on it. The item foreign key uses ON DELETE CASCADE, so the existing final deletion removes association rows only when its normal Storage-cleanup gate allows item removal. Place records survive. Unknown future dependent tables still block preflight before Storage deletion. Existing 009 split/delete/storage functions and policies are otherwise unchanged, and no old migration file is edited.

## Manual Supabase action

1. Verify the production migration baseline through 010, including `import_batch_items` (007), `preview_attempts` (008), image sets/lifecycle functions (009) and Person-link RPCs (010). Do not infer live installation from Git. Review the normal recovery/backup point.
2. These read-only sentinel checks can help identify an unexpected baseline or prior installation; they do not certify every function definition:

   ```sql
   select
     to_regclass('public.import_batch_items') as bulk_007,
     to_regclass('public.preview_attempts') as attempts_008,
     to_regclass('public.image_sets') as image_sets_009,
     to_regprocedure('public.create_identified_person(uuid,uuid,text,text)') as people_010,
     to_regclass('public.places') as places_011,
     to_regclass('public.item_places') as item_places_011;
   ```

3. On the confirmed baseline, manually apply the **complete** new 011 file, BEGIN through COMMIT, once. Do not rerun 001–010 or overwrite an unexpected existing Places schema. If it fails, stop and reconcile the exact error/live objects before retrying; the complete-file transaction should roll back that attempt.
4. Deploy the reviewed application code through the normal manual workflow after schema installation. No new secret, environment variable, paid provider or Storage bucket/policy change is required. Installation creates no Place from historical Where text and does not move/delete/convert any original or derivative. The initial Places directory may therefore be empty until the user deliberately adds/reconciles records.

## Exact production smoke test

1. After the reviewed migration and deployment, sign in as Editor/Admin and open Places. Confirm A sense of place., Add a place and the current archive's records only. Create a name-only Place; it should immediately appear as an empty card. Edit its optional region/country/notes and verify reload persistence. Latitude/longitude must remain optional; no geocoding/network provider request should occur.
2. Open an intended photograph and record its original Where wording, original file IDs/paths/sizes/hashes and relevant existing provenance. Search/select an existing Place. Verify a same-archive `item_places.place_id`, a reported primary association and View place. The original `reported_place` must remain unchanged. Confirm the association as Editor if historically justified.
3. On another approved item, create a minimal Place inline. It must immediately link to that item. Remove its association: the Place must survive and the report remain in history. A confirmed primary may be changed only through permitted Editor review; changing primary retains the prior relationship as removed history.
4. For an existing free-text report, deliberately use Link to existing place or Create place from reported text. Choose/review the intended canonical name. Verify the original wording survives in the item and relationship snapshot/provenance. No other text reports or items should be converted automatically.
5. Open the Place. Only actual linked material should appear in its source-type/date sections. Connected People must come from shared item relationships and must not be labelled residents. Follow a Person and the Place's Explore link. Select another Place in Explore: results must follow UUID relationships, including no match for unlinked/removed relationships whose name remains in text.
6. Check Places with zero, one and several completed image sets. Inspect Network: overview requests must be small WebP derivatives (maximum edge 600), never original/display bytes or conversion POSTs. Throttle images to see immediate LQIP and stable dimensions; scroll to load below-fold cards. Check 375px and a physical iPhone/Safari for overflow, clear names and large tap targets.
7. Use a Viewer and a Contributor test account. Viewer controls/mutations must be denied. Contributor linking/inline creation must work only on their own unverified ready item and must not replace a confirmed/another actor's primary report. Create the same Place name independently in a second archive and verify isolation; cross-archive item/Place IDs must be rejected. Test through authenticated application sessions, not the privileged SQL Editor role.
8. Verify existing People material/pickers/filtering and individual-photo catalogue editing. For an intended legacy split, shared Where wording and Place links must stay on the archived parent; assign appropriate child locations deliberately. On an explicitly approved disposable item in a test archive, exercise archive/restore and permanent deletion: links must be cleaned up after Storage completion, the Place must remain and other items must survive. Do not delete family originals merely to test this release.
9. Sign out. Place/item pages must redirect and private assets remain denied, including conditional requests. Confirm source IDs/paths/hashes from step 2 are unchanged after ordinary viewing/linking. Capture hosted query/asset timings if latency needs further investigation; local protocol fixtures cannot establish Vercel/Supabase or physical Safari acceptance.

[Validation](validation.md) · [exact commit manifest](archive-places-commit-manifest.md)
