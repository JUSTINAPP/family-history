# People as archive entry points / private delivery performance

Base commit: `e769afd`. This release uses the existing schema through 010. **No migration 011 or manual Supabase SQL is needed.** Migrations 001–010, RLS, immutable-original rules and item management RPCs are unchanged. No hosted project was queried or modified, and nothing was staged, committed, pushed or deployed by the agent.

## People overview and selection

Live People cards draw only from their active, archive-scoped reported/confirmed Person associations. With no material, a muted outline and “A story still to gather” remain; with linked material but no completed image set, the card reports previews pending. A single item is shown once without rotation. Two to four representative items form a restrained overlapping stack, using their actual aspect ratios, natural edges and small offsets/rotations. No generated photographs, tape, simulated paper mats or fictional material is added. The entire card opens its Person page; prefetch is disabled on the cards so many People do not trigger speculative Person-page query chains.

Selection is deterministic and runs in memory over batched records: active same-archive relationships only; duplicate reports for the same item are combined; confirmed (`accepted`) associations rank first; completed image sets are required for visual leaves; photographs rank first within a status tier; subsequent choices prefer a new source type within the same tier; stable item ID breaks ties. At most four lean item records are serialized per card, without catalogue notes/recollection bodies. Jina and every other Person use this same code; there are no special names/file IDs or AI selection calls.

Only the set's **small WebP, maximum edge 600px**, is requested on the overview. There is no srcset that can select a 1200px thumbnail or 2400px display, no original request, no signed URL generation and no automatic conversion on overview errors. Existing tiny placeholders and container/leaf ratios are in the server HTML; images fade in with native lazy loading. Below-fold stacks remain lazy. Mobile uses one legible card per row at narrow widths, two at tablet widths and three on desktop. The layer container contains rotation overflow.

Person detail groups real linked material into Photographs, Letters & documents and other material, plus recollections from those linked items and dates actually present in the catalogue. Empty sections are omitted. Recollections retain links to their original item context. There is no live structured story model in this application yet, so no Related stories section is fabricated. Existing relational Explore filtering remains unchanged.

## Findings and changes

The prior layout loaded an incomplete workspace, the destination page frequently loaded another workspace, and the client provider automatically fetched the complete workspace again after hydration. This repeated archives, memberships, People and optional-resource queries, as well as remote Auth user checks. The People grid initially depended on that client fetch despite having a server-rendered page shell.

- React `cache` now deduplicates the authenticated client/session, archive list, membership reads and normalized workspace loads **within one server render request**. No cached session/data is shared across requests or users.
- Home, Explore, People and Person detail use a small layout shell plus their own material load. Material pages do not wait for unrelated activity/job queries. Pages that rely on the workspace context still receive a complete server snapshot; explicit refresh after writes remains supported. The unconditional hydration-time `/api/v1/workspace` fetch is removed.
- People/material/association/image-set metadata are read in paginated archive-wide batches, not one chain per Person. Association grouping uses maps rather than scanning all relationships for each item. The live overview receives lean card props rather than a full client catalogue snapshot. Person recollections are fetched in batches of up to 100 linked item IDs, with pagination within each batch; they are not fetched per item or per card.
- Private asset delivery still requires a function hop, authentication, an RLS-visible file query and, on a cold response, Storage download. `Server-Timing` separates auth/database/Storage. A conditional response can now avoid Storage and byte transfer (see below). No sequential signed URL creation was found on this image path; the existing audio-original signed URL path is separate and unchanged.
- Fonts are local with `font-display: swap` (five TTF files total approximately 284 KiB uncompressed); no external font service blocks rendering. Current script/hydration costs can be inspected with the diagnostics below. The work does not claim to eliminate shared application bundles or all large-archive payload costs.

## Controlled local before/after measurements

Measured old `e769afd` and the new production build using the same synthetic loopback Auth/PostgREST/Storage fixture, five People and one grouped item, after sign-in/preview warm-up. Speculative navigation prefetch was blocked for this comparison; browser routing also makes this a cold-style asset request comparison. Counts include asset file lookups, exclude fixture-control endpoints, and do not represent production Supabase query plans or internal RLS function executions.

| Page | Database HTTP requests before | After | Hydration workspace requests before → after |
| --- | ---: | ---: | ---: |
| Home | 26 | 9 | 1 → 0 |
| Explore | 26 | 9 | 1 → 0 |
| People | 16 | 8 | 1 → 0 |
| Person detail | 25 | 8 | 1 → 0 |

Auth HTTP calls dropped 6→4 on Home/Explore and 4→2 on People/Person in that fixture. The fixture uses its Auth user endpoint for claims validation; hosted JWT behaviour may differ. The Person in this counting dataset has no links; a populated Person additionally fetches batched recollections and visible assets. A separate production browser test uses **33 People and more than 127 associations**, asserting one archives, one memberships and one People read, two paginated association reads and zero hydration workspace calls. Query counts scale with result pages/batches, not one query chain per Person.

Loopback response-end samples were Home 28→32ms, Explore 22→19ms, People 16→33ms, Person 22→15ms. These tiny timings are noisy and are **not a demonstrated hosted latency improvement**. The former People HTML could arrive before its client catalogue; the new response already includes selected material and placeholders. The reliable local result is removal of repeated work. Vercel cold starts, deployment/Supabase region distance, real Auth/Storage latency, bandwidth and physical Safari must still be measured in the signed-in production smoke test.

Reproduce against local fixtures only (reserve ports 4300/4301):

```sh
# Produces the separate fixture-configured .next-test build, not a deploy artifact.
npm run test:previews
node scripts/profile-pages.mjs

# Starts its own local fixture and development app; verifies browser diagnostics.
PROFILE_DEV=1 node scripts/profile-pages.mjs
```

The profiler overrides hosted configuration with loopback values; it does not use the family's Supabase project. Before/after temporary reports are `/private/tmp/archive-people-before.jsonl` and `/private/tmp/archive-people-after.jsonl`; do not commit test reports.

## Cache and security strategy

Pages, original files, asset errors and redirects remain `private, no-store`. Private derivative success responses use **`private, no-cache, must-revalidate`**, a content-hash ETag, and `Vary: Cookie, Authorization`. Every conditional GET validates authentication and performs the RLS-protected stored-file query **before** returning 304. A matching checksum then skips Storage download. Signed-out or revoked access must fail even with a previously valid ETag. The proxy lets this asset route set its own cache headers; it continues enforcing no-store elsewhere.

This allows private browser bytes to persist on the device, but grants no freshness window that bypasses permission checks on subsequent requests. Already viewed/saved content cannot be recalled from a user's device. There is no public/shared CDN image cache, cross-user data cache, persistent server session cache, public bucket, or new signed URL whose lifetime outlasts access revocation. Existing responsive variants and originals remain separate. A cold image still pays the protected route/Storage cost; measure `Server-Timing` before considering a different security trade-off.

## Development diagnostics

Start local development with `ARCHIVE_PERF_DIAGNOSTICS=1` (and explicit demo/fixture configuration for synthetic profiling). Only in `NODE_ENV=development`:

- Server `archive_query` events report static operation/table name, category, duration and request-local database/Auth counts. `archive_render` events label home/explore/people/person and report aggregate query time and an approximate data-loading/render interval. Parallel durations can sum above elapsed time; the interval excludes middleware, cold start and client hydration.
- Browser `archive_browser` console events report resource/image counts, script/font transfer bytes, rendered derivative tiers and document response-start timing. Resource figures are scoped to the current browser document since hard navigation; client navigation does not reset the browser's resource history.
- Private asset response headers expose `Server-Timing`, `X-Archive-Variant` and dimensions for signed-in inspection. They never include source paths, signed URLs or account details.

The new console diagnostics are not rendered or logged by production application code, even if the diagnostic environment flag is set. Events omit names, item/Person IDs, database rows, URLs, cookies and keys. The local profiler prints synthetic route paths/counters separately for reproducibility. No production diagnostic UI is introduced.

## Exact production smoke test

1. Deploy the reviewed code manually through the existing workflow. **No SQL migration or Supabase policy/bucket change is required for this release.** Verify the preceding 010 baseline separately if not already installed. Keep existing private buckets and Node image runtime.
2. Sign in and open People. Jina's card must automatically draw from her actual linked material; inspect the same behaviour for another Person. Check a Person with no links and one with exactly one link. Multiple materials must belong to that Person, appear in a stable order after reload and retain natural edges/aspect ratios. A link without a completed image set must show an honest pending/empty state rather than downloading a master.
3. In Network, confirm overview image requests are `/api/v1/assets/<small-file-id>`, WebP, max edge 600px, with `X-Archive-Variant: small`. There must be no original downloads, 1200/2400px choices or preview POSTs from the overview. Throttle/delay image requests to check that the stored LQIP and dimensions appear before image bytes; scroll down to verify below-fold stacks load as needed. Check 375px and a physical iPhone/Safari for overflow, legibility and tap targets.
4. Open Jina. Only real linked photographs/documents, recollections in their original item context and actual dates should appear. No empty/fake story section should appear. Follow Explore's Person filter and verify identical relational membership, not name-text matches. Check a different archive/account: its People/material must remain isolated.
5. Record Home, Explore, People and Person navigation waterfall timings, including waiting/TTFB, image counts/bytes and asset `auth`, `db`, `storage` Server-Timing. Confirm no automatic `/api/v1/workspace` request after hydration. Compare cold and repeat navigation; a small local query-count improvement is not a substitute for this hosted measurement.
6. Revalidate a derivative with its returned ETag. With authorized access, expect 304 and no Storage timing/download; without a matching ETag expect 200. Sign out, then request the same asset with the saved ETag: expect denial, not 304 or image bytes. Repeat after revoking a test membership using the existing explicit administration workflow. Errors remain no-store. Do not change policies to manufacture an outage.
7. Verify existing Person add/link/confirm/remove, per-photo catalogue edits, Explore filtering, archive/restore and the deliberately confirmed split workflow still work on appropriate material. Shared legacy context must remain on the archived parent. Use an approved disposable test item for permanent deletion/recovery, never the family's originals. Original IDs/paths/sizes/hashes must remain unchanged by ordinary viewing and this release.

See [validation](validation.md) and [exact commit manifest](people-material-commit-manifest.md). Automated screenshots use synthetic associations and the upstream sample image, not the family's material.
