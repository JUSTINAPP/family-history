# Combined preview/bulk/catalogue and audio commit manifest

## Actual Git state

At the start of the audio pass, `git log -1` showed preview/bulk/catalogue commit **0beddc2** (`Add HEIC previews bulk import and catalogue editing`). The index had no staged changes; `next-env.d.ts` was already modified. This differs from the earlier description of staged preview work. The agent left that commit, the index and next-env.d.ts alone: no commit, push, deployment, reset, stash or staging was performed.

Migration 005 is already installed remotely, as confirmed by the user. Only migration **006** requires manual review/application. Migrations 001–005 are unchanged.

## Audio working-tree files to review and commit

- `README.md`
- `docs/architecture.md`
- `docs/audio-commit-manifest.md`
- `docs/audio-recordings.md`
- `docs/data-model.md`
- `docs/ingestion-pipeline.md`
- `docs/permissions.md`
- `docs/supabase-setup.md`
- `docs/validation.md`
- `package-lock.json`
- `package.json`
- `public/images/audio-recording.svg`
- `scripts/test-database.mjs`
- `src/app/add/voice/page.tsx`
- `src/app/api/v1/audio/[id]/complete/route.ts`
- `src/app/api/v1/files/[id]/route.ts`
- `src/app/archive/[slug]/edit/page.tsx`
- `src/app/audio/[id]/edit/page.tsx`
- `src/app/globals.css`
- `src/components/audio/audio-capture.tsx`
- `src/components/audio/metadata-fields.tsx`
- `src/components/audio/private-player.tsx`
- `src/components/audio/recorder.tsx`
- `src/components/audio/recording-editor.tsx`
- `src/components/audio/recordings.tsx`
- `src/components/capture.tsx`
- `src/components/explore.tsx`
- `src/components/live/live-item.tsx`
- `src/lib/audio/actions.ts`
- `src/lib/audio/range.ts`
- `src/lib/audio/repository.ts`
- `src/lib/audio/server-validation.ts`
- `src/lib/audio/upload.ts`
- `src/lib/audio/validation.ts`
- `src/lib/backend/repository.ts`
- `src/lib/types.ts`
- `supabase/README.md`
- `supabase/migrations/202610310006_audio_recordings.sql`
- `tests/audio-browser.spec.ts`
- `tests/audio.spec.ts`
- `tests/live-auth.spec.ts`

## Existing preview/bulk/catalogue files already in commit 0beddc2

These belong to the combined implementation and are already present in HEAD. Do not try to recommit unchanged files; the audio list above includes any that audio extends further.

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

## Exclusions and deployment

Do **not** stage `next-env.d.ts`, `.env.local`, generated `.next*/`, test artifacts or generated `public/codecs/`. No new environment variables are needed. Run only migration 006 in the existing Supabase project, then deploy the reviewed code manually through the existing workflow. See [audio setup and smoke tests](audio-recordings.md).
