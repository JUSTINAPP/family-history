# The Allen & Cork Archive

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
