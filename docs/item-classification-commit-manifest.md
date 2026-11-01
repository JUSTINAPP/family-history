# Item classification / document entry — exact proposed commit contents

Base `85ecf28`. Review and commit only these 23 files. Nothing staged or committed by the agent.

- `README.md`
- `docs/item-classification-and-transcription.md`
- `docs/item-classification-commit-manifest.md`
- `docs/validation.md`
- `scripts/test-classification.mjs`
- `scripts/test-database.mjs`
- `src/app/globals.css`
- `src/components/capture.tsx`
- `src/components/live/document-actions.tsx`
- `src/components/live/item-editor.tsx`
- `src/components/live/item-type-field.tsx`
- `src/components/live/live-item.tsx`
- `src/lib/backend/classification-actions.ts`
- `src/lib/catalogue-presentation.ts`
- `supabase/README.md`
- `supabase/migrations/202611010015_item_classification.sql`
- `tests/bulk-intention.spec.ts`
- `tests/capture-admin.spec.ts`
- `tests/catalogue-scrapbook.spec.ts`
- `tests/fixtures/visibility-server.mjs`
- `tests/heic-preview.spec.ts`
- `tests/preview-pipeline-browser.spec.ts`
- `tests/upload-core.spec.ts`

Exclude generated `next-env.d.ts`, which reflects isolated `.next-test` route types. Preserve the existing local generated change outside this commit. Exclude `.env.local`, `.next*`, temporary fixtures/screenshots and test reports. No package/lockfile, environment variable or migration 001–014 change is needed.

Review covers the narrow classification RPC/action/control and preservation/permission guards, explicit pre-file capture intentions and idempotent Letter shortcut, existing document reader/processing entry, generated-placeholder display labels, synthetic capture/classification/browser/SQL tests and release documentation. The existing AI provider abstraction and OpenAI/Anthropic adapters, processing/review/translation/receipt/canonical-approval architecture are unchanged.

See [validation](validation.md) and [release/manual migration/exact live procedure](item-classification-and-transcription.md). No production SQL, live provider call, push or deployment was performed.
