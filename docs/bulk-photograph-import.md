# Separate photograph import and grouped archival items

## Confirmed production finding

The user manually inspected the production database and confirmed **one archive item with two archive_item_files rows, both purpose original, both linked to that same item**. This explains the single Explore entry: Explore lists items rather than individual files. The Add multi-select capture path sent every selected source under one capture UUID and one item, which is appropriate for pages/views of one physical item but was not an explicit enough choice for separate photographs.

Both photographs are represented by their original-file records on that existing grouped item. The user reports they appear to have been preserved successfully. The agent has no authenticated production database session and has not independently downloaded, hashed or checked the current Storage objects; two database rows alone are not an independent byte-integrity audit. No production item, file record, object or relationship was moved, split, deleted, replaced or re-uploaded. The existing grouped item remains available with both sources on its detail page. Any retrospective separation would require a distinct, reviewed action after checking source and derivative relationships; it is not performed automatically.

`scripts/audit-photograph-originals.sql` is an optional **read-only** SQL Editor audit of recent item/source rows, matching Storage objects, missing/incomplete receipts, existing displays and possible unreferenced original objects. It also reports an audio-006 schema indicator without assuming that migration is installed. It contains no repair or preview-generation RPC. No audit SQL was run remotely by the agent.

## Explicit capture intentions

Add now offers **Add one item**, **Bulk import photographs**, and Voice recording. Selecting multiple files for a Photograph in one-item capture stops before Save and asks whether they are separate photographs or views of one photograph. “Import as separate photographs” transfers the selected File objects into the bulk review screen without an upload or reselection. “Keep together as one item” intentionally retains front/back and other views. Letter pages, envelope/letter, document pages and multi-view objects retain their existing one-item/multiple-source model.

Bulk review → **Import all** creates one capture UUID, one archive item, one immutable original-file reservation/receipt and one preview job per selected photograph. There is no shared individual caption/recollection. Optional batch words are stored once on `import_batches` and displayed as group context, not copied into individual notes or recollections. Default individual titles remain “Photograph, still to be catalogued”. Even identical filenames/bytes selected as distinct entries are not silently discarded; each selected entry counts toward the explicitly reviewed batch.

Completion reports the exact number of photographs added to the current archive, with **View imported photographs**, **Catalogue first photograph** and **Add more**. Partial completion reports saved and failed counts and keeps successful entries accessible. Preview completion is independent: a failed/pending HEIC display never removes a ready item from Explore.

## Durable progress and safe retry

The batch has a persisted expected count. Every source reservation is linked to its batch in the same database transaction, before Storage upload. Progress pages at `/imports` and `/imports/:id` show ready and unfinished records, including the number not yet reserved when a tab closed early. No source bytes are stored in localStorage or a browser persistence database.

Keep the page open during upload. If it closes, reopen the batch from Recent imports and reselect the original batch files. The browser matches filename, byte size and SHA-256 to existing source reservations. Saved items are skipped; unfinished items retain their capture UUID and original path. A reserved object already present is checksum-checked on retry without upsert. Unstarted selections get new capture IDs within the remaining expected count. Selecting files does not itself upload; the user must choose Import all / Retry. Only the original importing account resumes those source reservations; Editors can catalogue the resulting archive content but do not impersonate the uploader.

The file-selection plan for sources not yet reserved is not a persistent offline file inbox: those original File objects must be selected again after reload. The expected count prevents this from being silently reported as a completed smaller batch. Import batches support up to 500 photographs / 30 MiB per source. Sources from a different batch should be imported as a new batch; this pass does not implement global cross-batch deduplication.

Storage writes remain UUID-based INSERTs with `upsert:false`. Existing hashes, provenance, source-purpose constraints and private Storage policies remain intact. No original is converted in place. Existing HEIC previews still use independently reserved private JPEG displays linked to the original.

## Browse and catalogue later

The batch gallery uses RLS-protected, invoker RPCs scoped to its archive and batch, so a bounded 500-photograph batch is complete even in an archive larger than the default API row limit. Explore fetches its current scoped snapshot at the page boundary, rather than relying on a cached root layout to refresh query parameters. Its cards use originals' IDs to resolve private previews; source readiness, not preview readiness, controls visibility.

Edit supports title/type, people, date/precision, place, notes and a new optional recollection field. `save_catalogue_context` calls the existing role-checked catalogue RPC and appends new original words separately in one transaction. A write UUID prevents an identical retry from duplicating the recollection. Original files and previous words remain unchanged. Save & next uncatalogued stays inside the current batch when supplied, selects an editable ready photograph, and skips catalogued entries. Contributors edit their own unverified material; Editors/Admins can catalogue other accessible items.

The new UI can be previewed in explicit demo mode at `/add/bulk?workflow=import`; it writes only in-memory demo captures and never calls Supabase. The earlier bulk demonstration remains at the ordinary demo bulk route. Production always uses the real persistence path.

## New migration and independence from audio

Review and manually apply **`supabase/migrations/202611010007_photograph_import_batches.sql`**. It creates two small archive-scoped tables, explicit SELECT grants/RLS, narrow create/reserve/catalogue RPCs and scoped read/next-photograph functions. It does not drop tables, alter or move existing originals, seed content, or replace migrations 001–006. Bulk uses the installed ingestion/permissions/catalogue foundation from 001–005 and **does not depend on 006**.

The local database tests cover both orders: 001–006 then 007, and 001–005 then 007 with 006 applied afterwards. No migration was applied remotely by the agent. Audio migration 006 remains a separate uncommitted file from the prior task; its remote installation status is not assumed. The audit's column-presence indicator can help confirm that schema shape, but it is not a deployment-history audit.

For the existing production project, use the SQL Editor to apply **007 only** if bulk is the immediate milestone. Do not blindly run a CLI push that would also apply a pending 006. If deploying the optional audio feature in the same release, review and apply 006 separately as well. Migrations 001–005 must not be rerun. No new environment variables or service-role credentials are required.

## Deployment order and smoke test

1. Retain the confirmed existing one-item/two-originals record. Optionally run the read-only audit to verify actual Storage receipts; do not repair or re-upload automatically.
2. Review/run only 007 in the current project. Verify 006 separately; apply it only when intentionally shipping the audio milestone.
3. Review the [combined working-tree manifest](bulk-import-commit-manifest.md), exclude generated next-env.d.ts and secrets, then commit/deploy manually through the existing GitHub/Vercel workflow. No commit, staging, push or deployment was performed by the agent.
4. Import two separate JPEG/HEIC files with all metadata blank. Expect two distinct item UUIDs, each with one original. Reload the batch gallery and Explore. Download originals and compare SHA-256; previews may finish later.
5. Import twenty photographs with optional batch context. Check twenty items and zero automatically copied recollections. Interrupt one upload, retry, reload and reselect through Recent imports; successful originals must not duplicate.
6. Intentionally group front/back as one Photograph and two letter pages as one Letter. Expect one item with two originals in each case.
7. Catalogue the first imported photo, add a separate recollection and Save & next uncatalogued. Confirm movement within the batch and Contributor/Editor gates. Open the existing HEIC item as its contributor or an Editor to prepare a retrospective display only when ready to authorise that production write.

Retrospective HEIC display generation does not require a new import/batch: it reads a stored original, verifies the recorded checksum, and stores a separate JPEG through the existing authenticated preview route. The local conversion/immutability tests remain covered. The agent did not generate a preview for the real production HEIC, since that would create remote objects contrary to this task's boundary.
