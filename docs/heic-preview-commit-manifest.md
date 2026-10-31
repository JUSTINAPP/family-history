# HEIC preview repair — files to commit

Review these changes together. Nothing was staged, committed, pushed or deployed. The starting tree contained only the pre-existing generated `next-env.d.ts` modification; leave that file out.

- `README.md`
- `docs/architecture.md`
- `docs/data-model.md`
- `docs/heic-preview-commit-manifest.md`
- `docs/hosted-heic-previews.md`
- `docs/ingestion-pipeline.md`
- `docs/supabase-setup.md`
- `docs/validation.md`
- `package.json`
- `playwright.config.ts`
- `playwright.preview.config.ts`
- `scripts/audit-preview-processing.sql`
- `scripts/check-preview-bundle.mjs`
- `scripts/preview-worker.cjs`
- `scripts/test-database.mjs`
- `scripts/test-preview-pipeline.mjs`
- `src/app/api/v1/previews/[id]/route.ts`
- `src/components/archive-image.tsx`
- `src/lib/backend/request-origin.ts`
- `src/lib/preview/convert.ts`
- `supabase/README.md`
- `supabase/migrations/202611010008_preview_processing.sql`
- `tests/fixtures/visibility-server.mjs`
- `tests/preview-bulk.spec.ts`
- `tests/preview-pipeline-browser.spec.ts`
- `tests/request-origin.spec.ts`

Migration 008 is the only new migration. Migrations 001–007 are byte-identical to HEAD. Do not include `.env.local`, generated codecs, `.next*`, test outputs, temporary samples or copied deployment bundles. No dependency was added. The real upstream sample was downloaded only to temporary storage, not copied into this repository.

[Root cause, manual actions and exact production smoke test](hosted-heic-previews.md).
