# Combined current working-tree commit manifest

The existing HEIC/preview/bulk/catalogue foundation is in HEAD (0beddc2). The audio work from the previous pass remains uncommitted in this working tree. This bulk correction preserves it. No Git staging, commit, reset, stash, push or deployment has been performed.

Review and commit the following current changed/new files together, or split them carefully with the shared-file dependencies reviewed. The list covers preserved audio work and this bulk fix. Do not discard overlapping audio changes when reviewing catalogue, file-route, provider or documentation updates.

- `README.md`
- `docs/architecture.md`
- `docs/audio-commit-manifest.md`
- `docs/audio-recordings.md`
- `docs/bulk-import-commit-manifest.md`
- `docs/bulk-photograph-import.md`
- `docs/data-model.md`
- `docs/ingestion-pipeline.md`
- `docs/permissions.md`
- `docs/supabase-setup.md`
- `docs/validation.md`
- `package-lock.json`
- `package.json`
- `public/images/audio-recording.svg`
- `scripts/audit-photograph-originals.sql`
- `scripts/test-database.mjs`
- `src/app/add/bulk/page.tsx`
- `src/app/add/voice/page.tsx`
- `src/app/api/v1/audio/[id]/complete/route.ts`
- `src/app/api/v1/files/[id]/route.ts`
- `src/app/archive/[slug]/edit/page.tsx`
- `src/app/audio/[id]/edit/page.tsx`
- `src/app/explore/page.tsx`
- `src/app/globals.css`
- `src/app/imports/[id]/page.tsx`
- `src/app/imports/page.tsx`
- `src/app/layout.tsx`
- `src/components/audio/audio-capture.tsx`
- `src/components/audio/metadata-fields.tsx`
- `src/components/audio/private-player.tsx`
- `src/components/audio/recorder.tsx`
- `src/components/audio/recording-editor.tsx`
- `src/components/audio/recordings.tsx`
- `src/components/capture.tsx`
- `src/components/catalogue.ts`
- `src/components/explore.tsx`
- `src/components/import-selection.tsx`
- `src/components/live/bulk-import.tsx`
- `src/components/live/item-editor.tsx`
- `src/components/live/live-item.tsx`
- `src/components/live/session-layout.tsx`
- `src/components/ui.tsx`
- `src/lib/audio/actions.ts`
- `src/lib/audio/range.ts`
- `src/lib/audio/repository.ts`
- `src/lib/audio/server-validation.ts`
- `src/lib/audio/upload.ts`
- `src/lib/audio/validation.ts`
- `src/lib/backend/actions.ts`
- `src/lib/backend/repository.ts`
- `src/lib/backend/upload-core.ts`
- `src/lib/bulk-import.ts`
- `src/lib/bulk-resume.ts`
- `src/lib/import-batches.ts`
- `src/lib/types.ts`
- `src/lib/workspace-types.ts`
- `src/proxy.ts`
- `supabase/README.md`
- `supabase/migrations/202610310006_audio_recordings.sql`
- `supabase/migrations/202611010007_photograph_import_batches.sql`
- `tests/audio-browser.spec.ts`
- `tests/audio.spec.ts`
- `tests/bulk-intention.spec.ts`
- `tests/live-auth.spec.ts`
- `tests/preview-bulk.spec.ts`

## Schema/deployment decisions

- `supabase/migrations/202611010007_photograph_import_batches.sql` is the only new migration for this bulk correction. It requires 001–005 and works with 006 absent or installed. Review/apply 007 manually before deploying the corrected bulk workflow.
- `supabase/migrations/202610310006_audio_recordings.sql` remains the separate prior audio milestone and has not been changed by this bulk pass. Its remote application status is not assumed. Review/apply it separately if enabling the audio feature. Do not blindly push pending migrations together.
- Never rerun 001–005 or alter/delete existing production originals. The original one-item/two-source record remains unchanged.
- `scripts/audit-photograph-originals.sql` is read-only and optional for further physical Storage receipt checks, not a repair migration.

Exclude `next-env.d.ts`, `.env.local`, generated `.next*`, test artifacts and generated `public/codecs`. Existing environment variable names are sufficient. See [deployment order and smoke tests](bulk-photograph-import.md).
