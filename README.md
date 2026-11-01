# The Allen & Cork Archive

**Current release — living archive scrapbook and simpler photograph separation:** New bulk imports already create independent photographs. Legacy separation now uses one simple confirmation and a separate Editor review for shared notes. Display labels progress with real context without rewriting titles; the logged-in homepage uses stable real-material compositions and small private images. Existing Places (011) is retained; this pass adds no migration. See [release, validation and exact production smoke test](docs/living-scrapbook.md) and [files to commit](docs/living-scrapbook-commit-manifest.md). Earlier release notes below describe their original interfaces.

**Current release — archive Places (011):** Create archive-local Places, link items through a searchable Where picker, reconcile historical wording explicitly, browse real material piles and filter Explore by Place relationships. No global location directory or geocoder is introduced. See [schema, manual Supabase action and exact production smoke test](docs/archive-places.md).

**Current release — People material stacks and private-page performance:** People now open through their actual linked archive material, with 600px thumbnails, immediate placeholders and richer Person sections. Request-scoped loading removes repeated workspace queries; private conditional derivative responses recheck permissions before reuse. No migration 011. See [measurements, cache trade-offs and exact production smoke test](docs/people-material-performance.md).

**Current release — Person relationships (010):** Search/select existing People, create and link a minimal Person inline, reconcile legacy identification text explicitly, and filter Person pages/Explore by real relationships. The legacy-photo split confirmation now asks how to retain shared context. See [release and manual production smoke test](docs/person-identifications.md). Only migration 010 is new; 001–009 are unchanged.

**Current release — individual photographs and image optimisation:** Migration **009** adds Editor item archive/restore, explicit legacy-photo splitting, resumable confirmed deletion and private responsive image sets. Earlier migration-only instructions below describe previous releases. Verify the installed migration history before applying only missing migrations. See [release order and exact production smoke test](docs/individual-photo-management.md), [validation](docs/validation.md) and [exact commit manifest](docs/item-management-commit-manifest.md). No remote migration, push or deployment was performed.

**HEIC production-build repair:** The server worker now receives a typed source envelope that survives Turbopack bundling. Additive migration 008 records per-original preview attempts/failures; originals and private Storage remain unchanged. See [diagnosis, verification limits and manual deployment smoke test](docs/hosted-heic-previews.md).

**Discoverability fix (current):** All RLS-permitted archive rows are listed with paginated reads; preview, metadata and optional-service failures do not hide saved items or block their detail routes. No new migration is needed for this fix. See [trace, tests and deployment smoke test](docs/saved-item-discoverability.md).

**Bulk-photograph correction (current):** Production inspection confirmed two originals grouped under one item. Capture now explicitly distinguishes one item’s views from separate photographs, with durable import batches and separate batch context. Apply only new migration **007** for bulk; it works without audio migration 006. Existing production sources are unchanged. See [workflow, audit and deployment](docs/bulk-photograph-import.md).

**Audio follow-up (current):** Real microphone/file recording, attached voice recollections and standalone oral histories are implemented locally. Migration 005 is already applied. Apply **only migration 006**, manually, before deploying audio. See [audio setup, permissions and smoke tests](docs/audio-recordings.md). No remote SQL/data changes were made in this pass. Earlier references to demo-only voice describe the retained prototype.

**Current follow-up:** The live archive has been created (confirmed by the user). Private HEIC display previews, real bulk import and catalogue editing are now implemented locally. Apply **only migration 005** to the existing project; do not rerun first-install SQL. See [preview, bulk and cataloguing setup](docs/preview-bulk-cataloguing.md) for current behaviour, deployment and limits. Earlier foundation status below is historical where it says the hosted schema is absent or bulk/preview processing is deferred.

A private archive with an editorial visual system and an initial Supabase backend foundation. Archive is the top-level concept; one account can own or join several archives with independently assigned membership roles. Historical People remain separate from authenticated Members.

## Run

```sh
npm ci
npm run dev
```

Use the printed Local URL. Save Supabase configuration only in ignored `.env.local` using the variable names in `.env.example`. **Real mode is the default**: authenticated routes never silently fall back to fictional content. No service-role or AI key is required.

**Existing live project:** apply only `202610310005_previews_and_cataloguing.sql`, then deploy this change. The user has confirmed the initial archive is already created. [Follow-up setup](docs/preview-bulk-cataloguing.md) covers existing HEIC previews, bulk import, editing and deployment smoke tests. Fresh projects can use the full [Supabase setup](docs/supabase-setup.md).

## Connected foundation

- Supabase SSR clients/proxy, email/password sign-in/signup, confirmation callbacks, sign-out and server-side session checks.
- RLS-protected Archives and memberships, independent per-archive roles, owner protection, optional membership-to-Person links.
- Persistent people creation for editors, archive settings, source items, written recollections and member role/access changes.
- Existing-file capture: preview → optional written context/details → private original upload → durable item/recollection/receipt → reload and Explore. Multi-page originals are grouped and ordered.
- UUID-safe source paths, MIME signature/size checks, application SHA-256, immutable-original policies, idempotent retries, private authenticated delivery and durable queued display jobs.
- Five version-controlled migrations with explicit grants, same-archive foreign keys, RLS and narrow write RPCs. No fictional record seed or hard-coded admin email/password.

## Deliberately not connected yet

Voice uses a clearly labelled spoken example and is not stored as a real recollection. AI/transcription, facial recognition, image-generation/restoration, distributed background workers, secure invitation email/redemption, full backups and detailed places/stories/tree editing remain off. The live UI shows clean/queued/not-connected states rather than fictional records or fake processing progress.

The previous visual demo remains available explicitly:

```sh
ARCHIVE_DEMO_MODE=true ARCHIVE_BUILD_DIR=.next-test npm run dev -- --hostname localhost --port 4100
```

That mode uses replaceable fixtures and session state only, even when Supabase configuration exists. Keep it separate from private data.

## Structure

```text
src/app/                 App Router pages, Auth callbacks and authenticated APIs
src/components/          Existing editorial/capture UX, plus a live-data adapter
src/lib/supabase/        Browser/server clients, configuration and SSR session support
src/lib/backend/         RLS-scoped queries, server actions, upload validation/receipts
src/proxy.ts             Token refresh and anonymous-route protection
supabase/migrations/     Additive schema, private Storage, RLS and write RPCs
scripts/                 Local PostgreSQL/security tests and safe readiness check
public/                  Public demo assets only; never real private originals
```

## Validation

```sh
npm run lint
npm run typecheck
npm run test:db
npm run build
npm run check:backend
LIVE_TEST_BASE_URL=http://localhost:4000 npm run test:auth
```

With the separate demo server running: `TEST_BASE_URL=http://localhost:4100 npm run test:e2e`. The database tests exercise actual migration SQL in local PostgreSQL with Auth/Storage schema stubs, including RLS and original preservation. Hosted HEIC preview/bulk/edit smoke tests remain to be verified after applying migration 005 and deploying. See [validation](docs/validation.md).

[Supabase setup](docs/supabase-setup.md) · [Architecture](docs/architecture.md) · [Data model](docs/data-model.md) · [Permissions](docs/permissions.md) · [Ingestion](docs/ingestion-pipeline.md) · [Product architecture](docs/product-architecture.md) · [iOS boundary](docs/ios-companion.md)

Next: apply only migration 005 and verify the real HEIC preview, a small mixed-format batch, editing after reload and original download/checksum. No remote data was changed, pushed or deployed in this pass.
