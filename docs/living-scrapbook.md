# Living scrapbook, photograph separation and catalogue presentation

Base: `5803ed6` (Places is already committed). Implemented locally on 1 November 2026. No production service was queried or changed; no migration applied remotely; nothing staged, committed, pushed or deployed by the agent. The pre-existing generated `next-env.d.ts` change is excluded.

## Existing behavior retained

The bulk photograph importer iterates files with separate capture IDs and one-file ingestion requests. Every resulting photograph is an independent archive item with its own original, responsive derivatives, title, People, Place, date, recollections and catalogue workflow. The 007/009 single-original invariant and retry/idempotency checks remain. New bulk uploads do not reproduce the legacy grouped Jina item. Multi-view single objects/documents remain separate from bulk photograph import.

Places already shipped in `5803ed6`; this pass retains that implementation rather than recreating it. See [Places release 011](archive-places.md) for the schema, permission matrix and original validation. Places are archive-scoped records; `item_places` stores same-archive item relationships, roles, report/review state and original Where wording. Creation requires only a name, with optional locality, city, region, country, notes and coordinates. Directory editing is Editor-only; the narrow Contributor inline-create/link path remains limited to eligible own items.

The overview retains **A sense of place.**, Add a place and piles of up to four actual linked materials, with an honest empty placeholder. Detail sections and connected People derive from real associations, without residence inference. Item Where search selects UUID relationships, supports minimal inline creation and preserves raw contributor text separately. Explore Place filtering remains relational; text matching does not create an association. Maps, journeys and migration stories remain future work.

## Separation and earlier notes

An eligible grouped photograph offers **Separate these photographs**, a short explanation and **Separate photographs**. The next screen contains one confirmation: **Separate N photographs?** with Cancel and Separate photographs. It explains that each becomes its own item and originals remain unchanged. Technical management controls are absent from that confirmation. There are no radio choices, typed SPLIT field or acknowledgement checkbox.

The authenticated server action supplies the existing RPC's internal `SPLIT` token only after the user confirms. Database Editor authorization, version checking, eligibility, advisory locks and active-preview rejection are unchanged. Archive/restore and permanent deletion retain their own existing safeguards; removing the typed split field does not remove typed permanent-delete confirmation.

Separation still moves file-specific material and retains shared metadata, recollections, Person associations and original provenance on the archived source. No context is blindly copied to any child. Editors can use **Review earlier notes** afterward, select a resulting photograph and copy one written recollection or link one Person. Children link back to this review. The action checks Editor access, the actual source/child relationship and original evidence on the server; a forged destination is rejected. No service key is used.

A copied recollection is a new Editor contribution with an explicit earlier-shared-recollection prefix and original recorded timestamp; original text, contributor, timestamp and provenance remain intact on the source. Existing `add_recollection` writes the new contribution/provenance. Person copying uses the existing idempotent proposal RPC and creates a reported association, without inheriting confirmation. Ordinary retries check for an identical copied recollection before writing. This is deliberate re-reporting, not a new source-to-copy database relationship or a move of evidence. Audio, shared Place/date/title, unlinked name reports and other metadata are not automatically redistributed; Editors can consult the retained source and use the existing item editors.

## Display labels and catalogue state

Stored titles are never rewritten by rendering. The known generated `<kind>, still to be catalogued` sentinel and blank titles are treated as defaults. Other nonempty titles win. Presentation records title source separately from the raw title.

Derived labels use linked People first (up to two names, then “and others”), optionally followed by the reported date; approximate dates retain `c.`. Otherwise a Place produces “Photograph from …”, then a date-only label, then “Photograph with a recollection” or “Photograph with notes”. Only untouched, unreviewed material retains “still to be catalogued”. Historical Where/People wording counts as context without becoming a canonical relationship.

Catalogue state is **Not yet catalogued**, **In progress** when meaningful context exists, or **Catalogued** after the existing explicit catalogue-save workflow. Completeness does not require every field. Live Explore also distinguishes In progress from untouched Uncatalogued items. Detail, catalogue cards and home use the same presentation helper; the edit form keeps the actual stored title rather than silently saving a derived label.

## Homepage and performance

The logged-in homepage removes the explanatory landing-page hero. A quiet **From the archive** heading introduces up to nine real, clickable materials with restrained paper offsets, layering, natural source proportions and established typography. Recently added remains below as four compact linked entries. There is no invented historical material, tape or handwriting. The explicit demonstration homepage retains its separate illustrative content.

Selection is deterministic: sort ready material by update time, creation time and ID; anchor with the newest ready piece, then prefer new material types, People and Places and avoid repeatedly selecting the same import batch. Structured diversity uses metadata rather than inferred visual similarity. Refreshes preserve the ordering until archive data changes.

The scrapbook and recent images request only the existing maximum-600px small variants with stored LQIP, responsive layout and native lazy loading after the opening pieces. No original or display variant is requested and the homepage does not initiate conversion. Material without a ready small image remains reachable through Recently added with a text placeholder. Archive selection, People, relationship and image-set reads remain batched/request-deduplicated. Recollection presence adds one paginated archive read of IDs/item IDs, without reading full texts into card payloads. Existing private asset RLS/auth checks, ETags and permission-before-304 behavior remain unchanged.

## Database and manual Supabase action

**No new migration and no edits to migrations 001–011.** Migration 011 from the previous Places commit is still the schema prerequisite; its transactional structure and no-backfill behavior are unchanged. This pass needs no SQL if 011 is already installed. Do not rerun installed migrations. If 011 is absent, establish the exact 001–010 live baseline first and use the existing [Places installation instructions](archive-places.md). No production SQL was run or live schema state assumed here.

## Validation

- Lint and strict TypeScript pass.
- Production build and isolated HEIC decoder trace pass (1,280 × 854 JPEG, 287,570 bytes).
- 89 full demo regressions pass, including one-file bulk import, display labels, deterministic diverse selection, retained People/Places, mobile and accessibility checks.
- 5 authenticated production browser flows pass: image conversion/private receipts, archive/restore/separation/deletion, independent catalogue/People/context review, People stacks, Places and the homepage. Coverage includes one-confirmation separation without radios or typed SPLIT, no automatic context copying, rejected forged copy destination, selective note/Person copying and unchanged source evidence.
- Homepage browser checks verify stable real item links, LQIP, small-only image URLs/no responsive display candidate, lazy loading, 375px overflow and batched reads: one archives, memberships, People, Places and recollection request; paginated relationship reads rather than one per card. Desktop/mobile fixture screenshots were reviewed.
- 4 authentication-boundary checks pass, including private pages/assets, unsafe origins/redirects and phone sign-in accessibility. Existing derivative 200/ETag304/signed-out401 checks pass.
- Actual migrations 001–011 pass 261 disposable PostgreSQL checks; without optional audio, 234 pass and 006 can still install afterward.
- Authenticated 1,007-row discoverability/reload/archive-scope/outage flow passes.
- `git diff --check` passes; old migrations, environment files, package files and staged content are unchanged.

Browser protocols use loopback-only synthetic Auth/PostgREST/Storage; SQL/RLS are tested separately against actual migration SQL. Screenshots use an existing upstream sample with synthetic archive labels, not family originals. Hosted Supabase, real family-image diversity, deployment latency and physical Safari behavior still require manual smoke testing. An early fixture lacked `add_recollection`; its protocol handler was added and the final production suite passes. A demo start initially collided with the existing development directory; the final 89-test run used isolated `.next-test`, leaving the user's server untouched.

## Exact manual production smoke test after deployment

1. Confirm the installed baseline through 011 without rerunning installed SQL. Sign in as an Editor to the intended archive. Open home on desktop and a 375px phone: no explanatory hero, real linked material, readable captions and no horizontal overflow. Reload and confirm stable composition while data is unchanged.
2. In Network, inspect homepage image requests: existing small asset URLs only, no originals or 2400px display images. Throttle to see placeholders; scroll to load later material. Follow an image and its caption to the same source item. Open Recently added/View everything.
3. Bulk-import two disposable test photographs. Verify two separate items, each with one preserved original and its own image set. Add a Person/date/Place/recollection to just one; the other remains independent.
4. On an untouched test photo, check the default label. Link a Person: it becomes the Person's name. Add an approximate date: the derived label includes `c.`. On other test photos check Place-only and recollection-only labels. Enter an explicit caption and confirm it wins in detail, Explore and home; reopen editing and confirm no derived title was written to the stored caption. Partial context shows In progress without demanding every field.
5. On an **Editor-approved legacy grouped test item**, open Separate photographs. Check one confirmation, no radio/typed SPLIT, and no technical management controls. Cancel once and confirm nothing changes. Reopen and deliberately confirm. Verify one item per photograph, originals/checksums unchanged, and no shared notes/People silently copied.
6. In Review earlier notes, copy one written recollection and link one Person to a chosen result. Confirm only that photograph changes, the Person starts as reported, and earlier evidence remains on the source review. Open another result and verify independence. Keep the actual Jina item untouched until an Editor deliberately approves its separation.
7. In Places, create a disposable name-only Place; edit optional context. On a test item, search/select it, then inline-create another minimal Place. Verify raw Where wording remains separate and reconciliation is explicit. Check zero/one/many-material Place piles, real Place-detail material/People, and relational Explore filtering; raw text alone must not establish a link.
8. Recheck People overview/detail and filters. Switch archives: Places, People and material remain scoped. As a Contributor, verify only permitted own-item Place edits and no Editor separation/context-review controls.
9. Save a small asset URL/ETag, sign out, and retry it and private item/Place pages. Requests must fail closed (no image bytes or 304 signed out). Sign back in and confirm the intended archive opens correctly. No permanent deletion is necessary for this smoke test.

Exact proposed files: [commit manifest](living-scrapbook-commit-manifest.md). No push or deployment is included.
