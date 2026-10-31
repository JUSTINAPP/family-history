# Files to commit for preview / bulk / catalogue follow-up

The working tree was clean at the beginning of this pass. Commit the following changed/new files together after review. No commit or push has been made.

Only **202610310005_previews_and_cataloguing.sql** needs applying to the existing Supabase project. Migrations 001–004 are unchanged and must not be rerun there.

- `.gitignore`
- `README.md`
- `docs/architecture.md`
- `docs/data-model.md`
- `docs/ingestion-pipeline.md`
- `docs/permissions.md`
- `docs/preview-bulk-cataloguing.md`
- `docs/preview-bulk-commit-files.md`
- `docs/supabase-setup.md`
- `docs/validation.md`
- `eslint.config.mjs`
- `next.config.ts`
- `package-lock.json`
- `package.json`
- `public/heic-preview-worker.js`
- `scripts/prepare-preview-codec.mjs`
- `scripts/preview-worker.cjs`
- `scripts/test-database.mjs`
- `src/app/add/bulk/page.tsx`
- `src/app/api/v1/previews/[id]/route.ts`
- `src/app/archive/[slug]/edit/page.tsx`
- `src/app/globals.css`
- `src/components/archive-image.tsx`
- `src/components/capture.tsx`
- `src/components/live/bulk-import.tsx`
- `src/components/live/identification-form.tsx`
- `src/components/live/item-editor.tsx`
- `src/components/live/live-item.tsx`
- `src/components/live/live-workspace.tsx`
- `src/components/live/recollection-form.tsx`
- `src/components/local-source-preview.tsx`
- `src/lib/backend/actions.ts`
- `src/lib/backend/repository.ts`
- `src/lib/backend/upload-core.ts`
- `src/lib/backend/validation.ts`
- `src/lib/bulk-import.ts`
- `src/lib/capture.ts`
- `src/lib/preview/client.ts`
- `src/lib/preview/convert.ts`
- `src/proxy.ts`
- `supabase/README.md`
- `supabase/migrations/202610310005_previews_and_cataloguing.sql`
- `tests/fixtures/README.md`
- `tests/fixtures/preview.heic`
- `tests/heic-preview.spec.ts`
- `tests/live-auth.spec.ts`
- `tests/preview-bulk.spec.ts`
- `tests/upload-core.spec.ts`

Do not add `.env.local`, `.next/`, `.next-test/`, test artifacts or generated `public/codecs/`. `npm ci` runs the codec preparation script, copying the bundled browser decoder and its licence from the lockfile-resolved dependency. Existing environment names are unchanged.

See [deployment steps and smoke test](preview-bulk-cataloguing.md). Review `git diff` and the new files before committing; deploy through the existing GitHub/Vercel workflow only when ready.
