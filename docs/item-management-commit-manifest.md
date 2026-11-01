# Individual photographs / image optimisation — exact proposed commit

Base: `a2cf028` (committed HEIC repair). Include the following 42 files together. Nothing has been staged or committed by this release pass. No push, deployment or remote migration was performed.

```text
README.md
docs/individual-photo-management.md
docs/item-management-commit-manifest.md
docs/validation.md
scripts/audit-image-delivery.sql
scripts/measure-image-delivery.js
scripts/preview-worker.cjs
scripts/test-database.mjs
scripts/test-item-management.mjs
scripts/test-preview-pipeline.mjs
src/app/admin/deletions/page.tsx
src/app/admin/layout.tsx
src/app/api/v1/assets/[id]/route.ts
src/app/api/v1/previews/[id]/route.ts
src/app/archive/[slug]/edit/page.tsx
src/app/archive/[slug]/manage/page.tsx
src/app/explore/loading.tsx
src/app/explore/page.tsx
src/app/globals.css
src/app/imports/[id]/page.tsx
src/components/admin/admin-shell.tsx
src/components/archive-image.tsx
src/components/explore.tsx
src/components/live/bulk-import.tsx
src/components/live/image-diagnostics.tsx
src/components/live/item-manager.tsx
src/components/live/live-item.tsx
src/components/ui.tsx
src/lib/backend/catalogue.ts
src/lib/backend/item-management.ts
src/lib/backend/management-actions.ts
src/lib/backend/repository.ts
src/lib/preview/client.ts
src/lib/preview/convert.ts
src/lib/preview/types.ts
src/lib/types.ts
supabase/README.md
supabase/migrations/202611010009_item_management_and_image_sets.sql
tests/fixtures/visibility-server.mjs
tests/image-hierarchy.spec.ts
tests/live-auth.spec.ts
tests/preview-pipeline-browser.spec.ts
```

## Review and exclusions

- `next-env.d.ts` is excluded. Its only changes point generated route types at `.next-test`; this is local test-build state, not a required application change. Leave it unstaged. No `tsconfig.json`, dependency, lockfile, environment or secret change is required.
- Do not include `.env.local`, `.next*`, generated codecs, Playwright outputs, temporary logs, samples or copied traced bundles.
- The initially untracked `src/app/archive/[slug]/loading.tsx` was removed during validation because it changed unknown-item HTTP responses from 404 to streamed 200. It was never in HEAD and is not a deletion to stage. Explore's retained loading UI uses a status paragraph, preserving a single page h1.
- Existing migrations 001–008 are unchanged and must not be included as modified files or rerun on production. 009 is the only new migration.
- Reviewed SQL/RLS, split ownership/context handling, archive filters, deletion dependency gates/checkpoints/cleanup, private image-set delivery, responsive rendering, import links and corresponding fixture/test changes as one release. Permanent deletion deliberately grants only manifest-scoped Editor Storage removal after confirmed preparation; no public bucket, broad original UPDATE/DELETE policy, service-role credential or automatic historical repair was added.
- Final evidence: 77 full regressions, 4 authentication tests, production build/isolated decode/1 expanded authenticated integration, lint and TypeScript pass. Recovered unchanged SQL has 189 passing disposable database checks; the earlier 16 targeted tests are included in the full 77. This is not proof of hosted execution.

[Validation details](validation.md) · [release order and exact manual production smoke test](individual-photo-management.md)
