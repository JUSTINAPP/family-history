# Document processing — exact proposed commit contents

Base `0f8a283`. Review and commit only the following 38 files; nothing has been staged or committed by the agent.

- `.env.example`
- `README.md`
- `docs/document-processing-commit-manifest.md`
- `docs/document-processing.md`
- `docs/validation.md`
- `scripts/test-database.mjs`
- `scripts/test-documents.mjs`
- `scripts/test-preview-pipeline.mjs`
- `scripts/test-visibility.mjs`
- `src/app/api/v1/document-runs/[id]/route.ts`
- `src/app/api/v1/documents/[id]/route.ts`
- `src/app/archive/[slug]/review/page.tsx`
- `src/app/explore/page.tsx`
- `src/app/globals.css`
- `src/components/capture.tsx`
- `src/components/explore.tsx`
- `src/components/live/document-reader.tsx`
- `src/components/live/document-review.tsx`
- `src/components/live/document-suggestions.tsx`
- `src/components/live/identification-form.tsx`
- `src/components/live/live-item.tsx`
- `src/components/live/reviewed-document-notes.tsx`
- `src/lib/backend/management-actions.ts`
- `src/lib/documents/actions.ts`
- `src/lib/documents/provider-core.ts`
- `src/lib/documents/provider.ts`
- `src/lib/documents/repository.ts`
- `src/lib/documents/server.ts`
- `src/lib/documents/types.ts`
- `src/lib/identifications.ts`
- `src/lib/types.ts`
- `supabase/README.md`
- `supabase/migrations/202611010013_document_processing.sql`
- `tests/document-provider.spec.ts`
- `tests/fixtures/visibility-server.mjs`
- `tests/live-auth.spec.ts`
- `tests/preview-pipeline-browser.spec.ts`
- `tests/upload-core.spec.ts`

Exclude `next-env.d.ts`: its generated route-type paths reflect the isolated `.next-test` build/dev directory and do not implement this feature. Preserve the existing local change outside this commit. Also exclude `.env.local`, `.next*`, screenshots, temporary fixtures and test reports. No dependency/lockfile or migration 001–012 change is needed.

The review covers preservation/capture/reader, optional server provider and authenticated APIs, SQL permissions/lifecycle/history/review, canonical confirmation, reviewed-text search, synthetic tests and release documentation. The `.env.example` change contains placeholders only. Initial provider: OpenAI; Anthropic is reserved, not implemented. No actual AI request or production action has been performed.

See [validation](validation.md) and [release, manual schema/configuration and exact production smoke test](document-processing.md).
