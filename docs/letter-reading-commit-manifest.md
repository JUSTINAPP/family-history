# Letter reading / correspondence — exact proposed commit contents

Base `5edd775`. Review and commit only these 30 files. Nothing staged or committed by the agent.

- `README.md`
- `docs/letter-reading-and-correspondence.md`
- `docs/letter-reading-commit-manifest.md`
- `docs/validation.md`
- `scripts/test-documents.mjs`
- `src/app/api/v1/previews/[id]/route.ts`
- `src/app/archive/[slug]/review/page.tsx`
- `src/app/globals.css`
- `src/components/archive-image.tsx`
- `src/components/live/document-actions.tsx`
- `src/components/live/document-images.tsx`
- `src/components/live/document-reader.tsx`
- `src/components/live/document-review-summary.tsx`
- `src/components/live/document-review.tsx`
- `src/components/live/document-suggestions.tsx`
- `src/components/live/live-item.tsx`
- `src/lib/backend/repository.ts`
- `src/lib/catalogue-presentation.ts`
- `src/lib/documents/context.ts`
- `src/lib/documents/correspondence.ts`
- `src/lib/documents/reading-output.ts`
- `src/lib/documents/repository.ts`
- `src/lib/documents/review-choice.ts`
- `src/lib/people-material.ts`
- `src/proxy.ts`
- `supabase/README.md`
- `supabase/migrations/202611010016_reviewed_correspondence.sql`
- `tests/correspondence.spec.ts`
- `tests/fixtures/visibility-server.mjs`
- `tests/preview-pipeline-browser.spec.ts`

Exclude generated `next-env.d.ts`: it reflects isolated test-build route types and is not part of this release. Preserve its existing local change outside this commit. Exclude `.env.local`, `.next*`, temporary profiling scripts/fixtures/screenshots and test reports. No dependency, package/lockfile or environment change is needed.

Review covers human-decision-only correspondence display and progressive Letter labels; concise summary plus retained Advanced review; the small transactional 016 review-function change for text-only From/To; bounded private reading images and preserved rotation; route/proxy private conditional caching; concurrent/scoped metadata and run loading; reader payload projection with persisted provenance intact; SQL/unit/browser tests and release documentation.

Migrations 001–015, Anthropic/OpenAI adapters and processing cost/attempt/translation/source/search primitives remain unchanged. No source file, checksum, historical title or page sequence is rewritten by these presentation/caching changes. No production SQL/data access, real provider call, push or deployment was performed.

See [validation](validation.md) and [release/manual migration/exact smoke test](letter-reading-and-correspondence.md).
