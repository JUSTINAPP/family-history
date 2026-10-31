# HEIC previews, bulk import and catalogue editing

## What is implemented

HEIC/HEIF selection uses a **local, disposable Web Worker** with libheif compiled to WebAssembly. It renders the primary image into a JPEG preview in memory; the selected File remains unchanged. No selected image goes to an outside conversion service. JPEG, PNG and WebP keep their normal browser previews. Unsupported/oversized/undecodable images show an explicit state; import is independent of preview decoding.

After saving, an authenticated Next.js Node route reads the private original, verifies its existing SHA-256, and renders a separate JPEG, bounded to 2400 pixels on the longest edge. It uses libheif for HEIC/HEIF and Sharp for encoding and ordinary image orientation. The JPEG is reserved and uploaded without upsert into **archive-derived**, then its receipt is confirmed. Its archive_item_files row has purpose `display` and `parent_original_id` pointing to the original. The original's record, byte stream, EXIF and checksum remain unchanged. Downloads still use the original file route.

Explore and item pages request the display representation. HEIC cards without one show preparation/retry states. Existing uploaded HEIC originals are supported: an Editor/Admin, or the original contributor with active Contributor access, opens the item to prepare a preview. New captures/imports also request previews after source receipts complete. Viewers can read stored previews; they cannot create them. No remote backfill has been run.

The first image marked primary in the HEIF container is rendered; burst/depth/auxiliary images are not mistaken for separate imported photographs. libheif applies container orientation/mirroring; JPEG EXIF orientation is applied before encoding. Display output is an 8-bit JPEG without source EXIF/GPS. HDR/wide-gamut presentation may differ from Apple's display; the original remains the authoritative source. Validate the actual IMG_6390.HEIC orientation/colour on deployment. No AI is involved.

## Import first

`/add/bulk` accepts up to 500 image files per batch, 30 MiB per original. Each file gets its **own archive item and capture UUID**. Names, dates, places, tags, captions and recollections are optional. A source filename supplies the initial title. Optional batch words are saved as a separate attributed recollection on each item.

Uploads are sequential, bounded in memory per photograph, with per-item state and overall progress. A failed photograph does not stop later files. Retry skips saved items and reuses the same capture UUID for unfinished ones, verifying existing reserved hashes rather than overwriting Storage objects. No fictional data is seeded. Ready items appear in Explore immediately regardless of metadata or display readiness.

Both browser capture and bulk import now use the existing `begin_ingestion` → private Storage INSERT → `complete_ingestion` contract directly through the authenticated Supabase client. Web Crypto hashes original bytes and signature/type/size checks run before upload. Database/Storage policies enforce reservations, archive membership, ownership and receipts; no service-role key is introduced. This avoids Vercel's incoming function body-size limit for larger source photographs. The Node ingestion API remains available for other clients. SQL validates Storage size/MIME receipts; it does not cryptographically re-hash object bytes. Checksums are byte-integrity evidence, not proof of historical authenticity.

Keep the batch page open until import completes. Selected File objects and retry state are held in this tab; a persistent offline/reselect/resume inbox is not implemented. Leaving a partially completed batch does not remove sources already preserved. Re-selecting files as a new batch intentionally creates new items; cross-batch duplicate detection is future work. Preview jobs are requested separately and can be retried from an item if the page closes before they run.

## Catalogue later

An item has a restrained **Edit catalogue details** link. Editors/Admins may edit any accessible item; Contributors may edit their own unverified contributions. Viewers/Commenters cannot edit catalogue metadata. Verified catalogue records require an Editor. Database RPCs enforce these rules independently of the interface.

Editable fields: title/caption, type, people as reported text, approximate/year/exact/unknown date, place and notes/context. The existing separate recollection form adds an attributed account without replacing earlier words. Identification suggestions are independently stored and remain reported suggestions. This pass does not silently create verified historical Person links from free text.

Every catalogue save records actor/time, before/after values in provenance, and an activity event. Original files and existing recollections are untouched. Editing a verified item as an Editor returns the changed catalogue assertion to `family_reported`; verification is not carried over automatically. Save & next uncatalogued moves to another accessible ready item with `catalogued_at IS NULL`, oldest first; Contributors see only their own editable items. Saving even sparse details marks an item catalogued. This is a lightweight queue, not a completeness score.

## Required Supabase and deployment action

The user has confirmed the first archive exists in the live project. **Do not rerun migrations 001–004, reset the database, delete Storage objects or seed demo content.** Only this new migration is required:

`supabase/migrations/202610310005_previews_and_cataloguing.sql`

Review and run it once in the existing project's SQL Editor (or your normal tracked migration deployment). It adds two item columns, two preview RPCs, a catalogue RPC, a display-INSERT policy and a permission helper. It replaces the original unique item/page constraint with a purpose-aware constraint so source and display can share a page number, and adds one display per source. This is a schema-only constraint change; no existing row or object is deleted, converted or rewritten. It is transactional. Existing originals remain intact. No remote SQL has been applied by this development pass.

Install with `npm ci` so `postinstall` copies the pinned libheif browser bundle and its licence into ignored `public/codecs`. Do not commit that generated directory. Node workers load `scripts/preview-worker.cjs`; Next output tracing explicitly includes it, libheif and Sharp's platform packages. The preview route uses the **Node runtime**, not Edge, with a 60-second function duration and a 45-second conversion timeout. Configure at least 1 GiB function memory (2 GiB recommended for large HEIC images). Conversion rejects images above 60 million pixels and runs one conversion per warm function instance; callers retry busy instances. Browser preview requests are serialised per tab. This bounds common cases but is not a distributed background worker or global rate limiter. Keep the existing durable source flow if a codec/time limit fails.

After applying 005, commit the changed application/tests/docs/config plus the new migration and worker scripts, then deploy through your existing GitHub/Vercel process. Nothing was pushed or deployed automatically. Existing environment variables remain sufficient; no new secrets are needed.

## Deployment smoke test

1. Open the existing IMG_6390.HEIC item as its contributor or an Editor. Confirm its preview appears with correct orientation. Download the original and compare the previous SHA-256.
2. Import JPEG, PNG and HEIC together with all metadata blank. Reload Explore; each source should have a separate item. A pending preview must not hide an item.
3. Interrupt the connection during a batch. Reconnect and retry on the same page; already saved items must not duplicate.
4. Edit an imported item's people/date/place/notes, add a separate recollection and identification suggestion, save, then reload. Confirm provenance and the original hash remain intact. Try Save & next uncatalogued.
5. Confirm Viewer read-only access, Commenter suggestions/recollections, Contributor own-item editing and Editor archive-wide editing; a nonmember must not read originals or previews.

Local tests use synthetic fixtures and disposable PostgreSQL, never hosted user data. See validation.md for actual results and limits.

## Decoder sources and redistribution

[libheif-js](https://github.com/catdad-experiments/libheif-js) provides the WebAssembly decoder; its distributed LGPL licence is copied beside the generated browser bundle. Source/build instructions and upstream notices are in that package/repository. [Sharp](https://sharp.pixelplumbing.com/api-operation/) supplies JPEG rendering and EXIF orientation, with its package notices retained. These are deterministic image decoders/renderers, not generative services. The synthetic HEIC test fixture contains a plain coloured field and no personal material.
