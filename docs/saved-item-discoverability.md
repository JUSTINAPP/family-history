# Saved items must remain discoverable

## Scope and evidence

Production inspection supplied by the user confirms one archive item with two immutable originals. That grouping remains unchanged. This pass repairs discovery/reopening; it does not split, move, delete, rewrite or re-upload existing sources. No production preview generation or database mutation was run.

The agent did not have an authenticated production browser/database session or its failing request trace. The code-level failure paths below were traced and reproduced using the real application with a loopback-only synthetic Supabase/Auth service. This establishes concrete application defects, not an independently observed diagnosis of one particular production HTTP request.

## Traced path and fixes

1. **Rows → catalogue query.** The previous default query required `ingestion_status = ready` and fetched a single API page. The detail query also required ready status. Explore did not require title/date/people/place/recollection completeness, a successful display, a completed processing job or a catalogued flag. The new query fetches every row the existing RLS policies permit in the selected archive, in bounded pages with exact counts and deterministic ordering. No ingestion-status predicate is added by the application. Owned/Editor-visible unfinished records are labelled with incomplete receipts, not falsely reported as completed originals.
2. **Auxiliary resources → page availability.** Previously any error while loading files, people, activity, jobs or import links failed the entire workspace. Audio loading could separately fail the whole detail page. Optional resources now fail separately with bounded/fail-fast reads. Missing 006/007 resources cannot make the unscoped archive list disappear. A catalogue error produces a clear retry state, never a misleading empty archive/count of zero.
3. **Cached state → View everything.** A longer old snapshot could replace a newer server snapshot. That heuristic is removed. Explore owns its fresh page-level data, keys its filter state from the URL and uses an explicit unfiltered archive URL for View everything. Root chrome and detail rendering do not wait for a complete catalogue; client contexts refresh their catalogue separately so existing capture/people/audio/admin consumers retain their data.
4. **Card → detail.** Item cards keep an independent title/open link when an image fails. Retry is no longer a button nested inside the item's navigation link. Private card prefetch is disabled to avoid loading many complete detail pages merely because cards enter the viewport. The first original by page order is used consistently; the original count is shown on multi-source cards and other originals remain available in detail.
5. **Detail route → authorized row.** The item UUID is resolved directly through the signed-in user's RLS session, then its actual accessible archive is loaded. A stale/default archive cookie after sign-out/sign-in no longer causes an otherwise authorized item to return 404. A network/query error is distinguished from a legitimately inaccessible/missing row. Private item/Explore routes explicitly render per request; production item lookup no longer uses generated static slugs. Bookmarks work across sign-in; auth redirects retain their query parameters. Existing permission checks remain authoritative.
6. **Detail → assets.** Originals remain separate from derived displays. A failed preview shows Preview unavailable / Original safely preserved / Retry preview when its original receipt is known. The card can still open; detail still exposes original download/view, metadata editing and written recollections. Audio/next-catalogue loading failures do not block the photograph or its edit form. The existing 005 metadata RPC remains usable when the later catalogue wrapper has not been installed; original written recollections can still be appended from the item's separate form.

Counts refer to **RLS-visible rows in the current archive**, not an administrator's unfiltered total across archives, hidden archived audio or other users' inaccessible unfinished uploads. RLS, archive membership rules, private Storage policies and original bytes are unchanged.

## Confirmation and navigation

A separate bulk import reports N photographs safely added and links to that import's gallery with an explicit archive ID. Older batch-only bookmarks resolve their permitted archive from the batch instead of relying on the selected archive cookie. Intentional grouped capture reports one item safely saved with its original-file count and an unfiltered archive link. It does not incorrectly call two views of one item two separate photographs. Existing two-original records remain one discoverable item until a separately reviewed splitting operation is requested; no automatic split is part of this visibility fix.

## Regression coverage

`npm run test:visibility` starts a synthetic loopback-only Supabase protocol service and the actual Next.js application in real mode. Its URL/key are explicitly overridden with fixture-only values. It signs in a test identity through the existing sign-in form, never a hosted account, and never seeds or queries production.

The fixture contains 1,007 permitted rows, a hard 127-row response cap, an empty-title/no-metadata item with two originals, a failed-ingestion item with a stored original, another accessible archive selected by default, missing optional resources and failed previews. The test checks the full card/count total, placeholder/open controls, edit and recollection controls, both original links, original download checksum, reload, sign-out/sign-in and View everything. It then forces a catalogue outage, verifies the explicit retry screen, and still opens the known item URL independently. Additional unit tests cover 1,207-row pagination, incomplete/error results, null metadata, status independence and stable multi-source primary selection.

The normal photograph/HEIC/bulk/audio/written-recollection and PostgreSQL permission tests remain in place. This protocol fixture verifies application integration, not hosted Supabase's implementation of Auth/RLS/Storage; the separate disposable PostgreSQL suite exercises the actual migrations and policies. Actual production Vercel/Safari behaviour still needs the smoke test below.

## Migration and deployment

This visibility correction creates **no new database migration** and performs no remote data repair. Migrations 001–007 are unchanged in this pass. Unscoped View everything and authorized item detail work without optional audio/batch migrations; the separate bulk import feature still needs its existing 007, and audio still needs its existing 006. Their remote application status is not assumed. Do not rerun installed migrations or push pending SQL blindly.

Review the [combined working-tree manifest](visibility-commit-manifest.md), keep secrets and generated next-env.d.ts out of the commit, and deploy manually through the existing workflow. No staging, commit, push or deployment was performed.

## Production smoke test — no re-upload required

1. Sign in to the existing archive and choose View everything. With filters cleared, compare the displayed count to rows permitted to that same member/archive. The confirmed existing grouped item should appear once, with two originals inside.
2. Open it through its card title or Open item even while its preview is missing/failed. Confirm both original links and metadata/recollection controls remain usable. Download originals only if desired to compare their existing checksums; do not replace them.
3. Reload the detail URL. Sign out, sign in and reopen the same URL/bookmark. Test the archive breadcrumb and View everything link with no inherited search/type/date filters.
4. Confirm preview failure leaves the item/card visible. Retry preview only when intentionally authorising creation of a separate derived asset; do not alter originals.
5. For a new two-photo bulk import, verify the completion link opens two distinct items and missing previews do not change that count. Retain the old grouped record unchanged.

The exact cause of any remaining production-only failure should be captured from its authenticated request/status and the catalogue availability/count response, rather than asking the user to upload the originals again.
