# People in archive items — release 010

This release builds on committed `8df781c`. The user reports that migration 009 is now installed in production. This pass changes local code only: no production queries/mutations, migration application, staging, commit, push or deployment were performed. Migrations 001–009 are unchanged.

## Canonical relationships and evidence

The existing `identifications` table already relates `archive_id`, `item_id` and `person_id` with same-archive foreign keys. It is reused, not replaced by another join table or a text-name convention. `proposed_by` and `created_at` are the original creator/time; `proposed_name` is the original reported wording. Multiple People can be associated with an item.

Migration 010 adds `role_context`, `source`, optional numeric `confidence`, `linked_by`/`linked_at` and `reviewed_by`/`reviewed_at`. Existing records receive the source label `legacy_report`; no names are matched or Person links backfilled. Existing statuses remain compatible: `reported` displays as reported; `accepted` displays as confirmed; `rejected` records are inactive associations retained in Identification history. Removing an association never deletes the Person or original report. Provenance records explicit report, legacy-link, confirmation and removal actions with original attribution.

Future machine proposals belong in the existing `metadata_suggestions` layer with their Person candidate, provider/model, confidence and pending status. They do not populate canonical identifications automatically. Tests insert a synthetic 82% candidate and verify it does not establish a relationship. No facial recognition, AI service or automatic identity matching is implemented.

## Item and catalogue UX

The People section offers **+ Add person** → **Who do you recognise?**. Search the current archive's People by partial words (for example Ji → Jina Allen · Family) and explicitly select a result. Results are keyboard-accessible buttons; at most 30 matches are shown at once, so refine a search for a large archive. Selected People appear in removable rows with status, original-report context and View person links. Both item detail and its catalogue editor use this section. The old catalogue `people_text` field remains as clearly labelled reported text notes, not canonical relationships.

An Editor can choose **Link to existing person** on a legacy free-text report. Its original name, reporter and time survive unchanged. The matching picker suggests likely existing People but requires explicit selection. Linking alone does not upgrade reported identity to confirmed. Only a separate Editor action confirms it.

| Role | Person association permissions |
| --- | --- |
| Viewer | Read only; no identification mutation |
| Commenter / Contributor | Report an existing Person on a readable ready item; retract their own unconfirmed report |
| Contributor | Additionally create a minimal Person and link atomically on their own unverified item |
| Editor / Admin | Link legacy text to an existing Person; confirm or remove associations; create and link on any readable ready item |

Inline creation asks only for name and category (unknown/other, family, friend or unidentified). It creates the Person and reported association in one transaction; failure rolls both back. General People administration retains its existing Editor permission. SQL independently enforces archive, item lifecycle, ownership and role checks; hiding buttons is not the authorization mechanism. Existing direct table writes remain denied.

## Person pages and Explore

Live Person pages list **Photographs and archive items featuring [name]** from active, RLS-visible `person_id` relationships. Reported and confirmed relationships count; removed and unlinked text reports do not. The page links to Explore with the Person UUID and archive explicitly scoped. Archived parent contexts stay outside normal active-item results.

Explore's People filter uses these same Person IDs only. Names mentioned in old `people_text` notes are not treated as associations. General text search can still match reported notes. Catalogue relationships and People are paginated, including API caps; failed relationship reads produce an unavailable message when filtering rather than a misleading empty result.

## Legacy grouped photographs

An eligible Editor-visible multi-original photograph now prominently offers **Split photographs into separate items** on its detail page. This opens the existing management confirmation directly; Manage item still offers the action. The confirmation explicitly asks what to do with shared details/recollections: retain them on the archived parent and add/copy relevant context deliberately (the default), or keep photographs together for now (confirmation disabled).

The existing 009 split SQL is unchanged. Originals retain IDs, hashes, paths and derivatives. Each child has its own title/type, catalogue state, date, place, People and recollections. Shared metadata, identifications and Jina-specific historical recollections stay on the archived parent. They are not copied to all children. A Person link made on the archived parent therefore does not make either child feature that Person: explicitly add the appropriate Person to each relevant photograph. New separate-photo bulk imports already create independent items and never require splitting.

## Manual Supabase and deployment action

Only after reviewing the diff and normal backup/recovery readiness, manually apply the complete `supabase/migrations/202611010010_person_identifications.sql` (`BEGIN` through `COMMIT`) to the established baseline including 009. Do not rerun 001–009 or edit old migrations. 010 adds columns/index and narrow RPCs; it does not modify original bytes, create Person records from arbitrary historical text, or split existing items. Then deploy the reviewed code through the normal manual workflow. No new environment variable, secret, dependency or Storage policy is needed.

## Exact production smoke test

1. Before release, record the existing two-photo item ID, both original IDs/paths/sizes/SHA-256, its shared recollections and the legacy Jina report's ID, `proposed_by`, `proposed_name`, `created_at` and null `person_id`. Verify the installed baseline including 009 and review backup readiness. Manually apply only 010 and deploy the reviewed code.
2. Sign in as Editor/Admin. Open that item: both originals and the prominent split action must appear. Open the split confirmation, inspect the shared-context question, and choose “Keep the photographs together for now”: confirmation must stay disabled even after typing SPLIT and acknowledging. No data should change merely by reviewing/cancelling.
3. If the owner intends to split these separate photographs, select the default parent-retention policy, type SPLIT and acknowledge. Confirm two child items, two Explore entries and independent catalogue links. The archived parent must retain shared Jina-specific recollections and identifications; neither child should inherit them. Verify original IDs, hashes, sizes, Storage paths and derivative ownership against step 1.
4. Open the appropriate child and choose Add person. Type Ji and explicitly select the existing Jina Allen · Family. Confirm a real `identifications.person_id` points to Jina, not another Person created from her name. Add Jan as a second Person if appropriate, then reload. Do not establish an identity merely to exercise a test; use an approved test item where uncertain.
5. On the archived parent's legacy Jina report, choose Link to existing person and select Jina. Verify the same report ID, original wording, `proposed_by` and `created_at` remain; inspect the appended `identification_linked` provenance. Status must stay reported until the explicit Editor confirmation. This historical parent link must not automatically appear on either child.
6. Open Jina's Person page and Explore → People → Jina. They must show the active items actually linked to her. Jan's page/filter must reflect Jan's separate associations. A title/note containing “Jina Allen” without a Person ID must not pass her People filter; ordinary text search may still find that wording.
7. On an approved test item, create a minimal new Person inline, confirm it appears linked immediately, then remove the association. The Person and historical report must remain; the item must disappear from that Person's active relationship results. Verify Editor confirmation changes only the selected association to confirmed. Viewer controls must be absent; a Contributor cannot confirm or link someone else's legacy report, nor create a Person on another contributor's or a verified item. Cross-archive Person IDs must be rejected.
8. Catalogue child 1 with its own title, date, place, type, recollection and People; child 2 must remain unchanged and independently editable. Confirm Catalogued/Uncatalogued state and both Explore entries after reload. For the next intended bulk import, confirm each independent photograph already exposes the same controls without a split. Check keyboard/mobile Safari operation, then sign out and verify private pages/data remain inaccessible.

See [validation](validation.md) and the [exact commit manifest](person-identifications-commit-manifest.md). Hosted Supabase HTTP, the real family images and physical iPhone/Safari must be verified manually; local synthetic fixtures do not establish hosted acceptance.
