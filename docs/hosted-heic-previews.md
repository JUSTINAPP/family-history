# Hosted HEIC preview repair

## Root cause and evidence

The existing production-build conversion path fails **before HEIC decoding**, at `Buffer.from(workerData)`. Next 16.4.3's Turbopack worker factory augments worker data using object spread:

```js
workerData: { ...workerData, __turbopack_globals__: globals }
```

The application passed a bare `Uint8Array`. Spreading it produces an object with numbered properties but no typed-array prototype/length. The built worker throws: “Received an instance of Object”. The former worker catch suppressed that exception and returned only `preview_failed`; the route turned it into the generic 422 shown by ArchiveImage. Direct source-worker tests passed because they bypassed the production bundler. A real upstream HEIC decoded directly, failed through the unmodified production-built API, and passed through that API after the fix.

The fix passes `{ source }` and reads `workerData.source`. Turbopack's augmentation now preserves the nested typed array through structured cloning. This is the concrete reproduced production-build defect. No authenticated hosted function log or either actual family HEIC was accessed; matching the exact live request remains part of the deployment smoke test.

A second production-mode test exposed an origin check comparing the public Origin with Next's internal URL. The preview POST now checks the routed Host and effective protocol, rejects cross-site requests and ignores forwarded-host overrides. Archive authorization remains a separate database check.

## What Retry preview does

Previously it already called authenticated `POST /api/v1/previews/<original-file-id>`; it was never a decorative button or a browser-only conversion. It downloaded the stored original, verified SHA-256, invoked the server worker, reserved a derivative, uploaded it without upsert, and completed its receipt. The worker-data defect stopped that sequence before a JPEG could be generated. Failure did not update the queued job or expose a useful stage.

The browser's separate HEIC worker only produces a temporary local selection preview. It does not create the durable archive display. No local browser File or re-upload is required for server preview preparation.

## Current processing path

1. GET requests an authenticated display; an absent HEIC display returns a preparation-needed response. ArchiveImage automatically attempts the POST once; a subsequent **Retry preview** starts a real new request.
2. The POST resolves the preserved original with the signed-in member's RLS session. Migration 008 grants a short per-original processing lease only to an Editor or that item's Contributor, using the existing archive-scoped check.
3. It records the attempt, downloads from private `archive-originals`, and verifies both byte length and SHA-256 against the existing receipt.
4. An awaited, disposable Node worker decodes HEIC/HEIF with bundled libheif WebAssembly. HEIF container rotation/mirroring is applied by libheif once. Sharp auto-orients JPEG/PNG/WebP inputs; HEIF's already transformed pixels are not rotated again. Output is an sRGB browser JPEG, quality 85, at most 2400 pixels per edge, with transparency flattened against white and source metadata omitted.
5. The application reserves a separate `purpose=display` file linked by `parent_original_id`, uploads only to private `archive-derived` with `upsert:false`, then completes the verified receipt. Both originals on one legacy item receive independent derivatives. Item grouping is unchanged.
6. Existing cards, detail, import galleries and catalogue pages all request the same original-ID preview endpoint. It reads the stored derivative and returns JPEG bytes with `Cache-Control: private, no-store`; it does not expose a public bucket or durable public URL. Future People/Stories views should reuse this endpoint.
7. Failures retain the item/source, record stage and an error code per original and on the aggregate job, and return a request reference matching structured function logs. The UI exposes the failure explanation and Retry. The job becomes complete only once every original has a stored display.

An uploaded derivative whose database receipt was interrupted is verified and completed on retry without conversion or overwrite. An empty derived reservation can accept a new converter's checksum; uploaded/stored derivatives and all originals cannot be overwritten by this operation. A killed request's lease expires after 75 seconds; a stale attempt cannot finish or fail its replacement.

## Vercel architecture and limits

This is an **on-demand Node.js route**, not a daemon, scheduled worker, Edge function, or operating-system HEIC executable. The worker runs within and is awaited by the HTTP request. The processing-job row tracks work; a queued row by itself does not start a background process. A page's preparation request or explicit Retry initiates conversion, including for existing material.

The function declares a 60-second maximum. It budgets 50 seconds for processing, up to 35 seconds for decoding (reduced to leave time for storage), and bounds reads/RPCs and the upload wait. A timed-out upload may have reached Storage; the next request recovers the immutable reserved receipt. Inputs are limited to 30 MiB and 60 million pixels; output is limited to 10 MiB. One decoder runs per application instance, with database leases preventing same-source overlap between instances.

The existing Next output-tracing configuration includes the Node worker, libheif, Sharp and platform dependencies. The integration runner additionally copies **only the trace's files** into a disposable directory and decodes there, proving that it does not accidentally fall back to untraced repository modules. The production-built HTTP API and real browser then exercise the whole pipeline.

Vercel's [Node runtime supports Node APIs](https://vercel.com/docs/functions/runtimes/node-js); its [file packaging guidance](https://vercel.com/kb/guide/how-can-i-use-files-in-serverless-functions) uses Next's output tracing. libheif's [bundled WebAssembly entry](https://github.com/catdad-experiments/libheif-js#usage) contains the HEIC decoder; it does not depend on a system libheif installation. Sharp uses its normal platform package installed on the build host.

**Execution on hosted Vercel/Linux is not yet verified.** The verified environment is this Mac's Node 24 production build, real decoder and Chromium, with synthetic loopback Auth/PostgREST/Storage. There is no Vercel connection here and no deployment was performed. The actual IMG_6390.HEIC orientation/colour/codec variant still needs the smoke test below. Do not represent this local check as a successful hosted production repair.

## Migration and manual actions

- Review/apply only the new additive `supabase/migrations/202611010008_preview_processing.sql` to a project with the existing preview foundation (001–005). It is independent of optional audio/bulk migrations 006/007. It adds the RLS-protected `preview_attempts` table and narrow start/state RPCs, and permits correction of an empty derived reservation. It does not backfill attempts, start conversion, delete records, or touch original bytes. Migrations 001–007 are unchanged. This pass did not apply SQL remotely or assume the status of unrelated pending migrations.
- Deploy the reviewed code through the existing manual workflow. Keep the existing Supabase URL/public key; no service-role key, external conversion service, system binary or new secret is needed. Use the Node runtime and allow the route's 60-second duration. Install production dependencies normally; do not omit optional platform packages or copy Mac `node_modules` to Linux.
- Keep both archive buckets private. Do not add public Storage policies or widen membership roles. If a preview fails, use its displayed request reference and `preview_failed` structured log to identify `stage` and `code`. `preview_schema_unavailable` means check migration 008/schema cache before retrying.
- After deployment, an authorized member intentionally opens/retries the existing item. No re-upload, splitting, master replacement or bulk repair script is required. Nothing was pushed or deployed automatically.

## Reproducible tests

`npm run test:previews` builds a separate `.next-test` production app using explicitly overridden loopback-only fixture configuration, checks its traced bundle, and runs the authenticated browser flow. It uses the genuine small HEIC fixture by default. Reserve ports 4300/4301 and do not run another `.next-test` server concurrently. Do not deploy `.next-test`; the normal `npm run build` produces the application build with its normal configuration.

A larger real photographic HEIC from the upstream libheif repository was tested without adding that third-party image to this repository:

```sh
curl -fL https://raw.githubusercontent.com/strukturag/libheif/master/examples/example.heic -o /private/tmp/archive-example.heic
TEST_HEIC_FILE=/private/tmp/archive-example.heic npm run test:previews
```

Tested input: 718,114 bytes, SHA-256 `7f8b363e4936c0666a25f64f3a92fda10bd8e5453be4592530b65a55dd98f3f2`. Result: a separate 1280×854 JPEG, 351,967 bytes. The protocol fixture places that genuine HEIC in two source positions on one synthetic item; it does not use or seed the family's production originals.

Coverage includes real server decoding, two independent source/derived links, failure then actual Retry button clicks, byte-identical originals after conversion/download, private derived paths, idempotent completed requests, detail/Explore/reload display and sign-out denial. Separate tests cover HEIF container rotation, JPEG EXIF orientation, PNG/WebP conversion and damaged input. Disposable PostgreSQL tests execute the actual migration/policies, including foreign-role rejection, short leases, failure/complete state, immutable uploaded derivatives and interrupted reservation recovery. The loopback fixture alone is not proof of hosted Supabase's Storage implementation.

## Exact production smoke test — existing originals, no re-upload

1. Before deployment, use the existing item to record **both** original IDs, filenames, byte sizes, SHA-256 and private bucket/path. The known IMG_6390.HEIC is 2,896,761 bytes. Do not change or delete either source or its item relationship.
2. Review/apply 008 once, then manually deploy the code. Sign in as an archive Editor/Admin or the contributing Contributor. Open the existing item. Its normal preparation request may generate previews; otherwise click Retry preview separately for each original.
3. In Network, verify each source's POST `/api/v1/previews/<id>` returns 200. The following GET must return `Content-Type: image/jpeg` and `Cache-Control: private, no-store`. If not, retain the response's `requestId`, `stage`, `code` and matching Vercel log; do not re-upload. For a killed/overlapping request, wait at least 75 seconds before retrying.
4. Inspect the rows read-only (optionally use `scripts/audit-preview-processing.sql`). There must be two stored displays, each linked to the correct original, in `archive-derived`; the bucket must still be private. Each attempt should complete, and the item's display job should complete after both receipts.
5. Confirm both photographs display correctly on the item's detail page, including orientation and recognisable colour/content. Follow View everything and confirm the card displays; open the catalogue workflow and return. Reload each view. The old grouped item still counts as one item and exposes both original downloads.
6. Download each original through the existing authenticated original link and compare its size/SHA-256 with step 1. Both must match exactly; the HEIC masters and their relationships must remain unchanged. No source needs uploading again.
7. Sign out. The preview endpoint and direct private Storage path must deny unauthenticated access. Sign back in and confirm the stored JPEGs display without decoding again. No public URL/policy should have been introduced.
8. For the next intentional JPEG, PNG and WebP saves, confirm normal display and original download still work. For the next intentional bulk import, confirm the results/gallery/catalogue reuse the same derived endpoint. No extra production uploads are necessary to repair the existing two HEICs.

[Files to commit](heic-preview-commit-manifest.md).
