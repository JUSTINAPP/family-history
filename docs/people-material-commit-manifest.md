# People material stacks / performance — exact proposed commit

Base commit: `e769afd`. Include these 27 files together. Nothing has been staged, committed, pushed, deployed or applied remotely by the agent.

```text
README.md
docs/people-material-commit-manifest.md
docs/people-material-performance.md
docs/validation.md
scripts/profile-pages.mjs
src/app/api/v1/assets/[id]/route.ts
src/app/explore/page.tsx
src/app/globals.css
src/app/people/[slug]/page.tsx
src/app/people/page.tsx
src/components/archive-image.tsx
src/components/live/development-performance.tsx
src/components/live/live-home.tsx
src/components/live/live-workspace.tsx
src/components/live/session-layout.tsx
src/components/people-overview.tsx
src/components/people.tsx
src/components/person-material-stack.tsx
src/lib/backend/performance.ts
src/lib/backend/person-material.ts
src/lib/backend/repository.ts
src/lib/people-material.ts
src/lib/supabase/server.ts
src/proxy.ts
tests/fixtures/visibility-server.mjs
tests/people-material.spec.ts
tests/preview-pipeline-browser.spec.ts
```

Exclude generated `next-env.d.ts` (only test-build route type paths changed), `.env.local`, all `.next*` builds, generated codecs, Playwright artifacts, temporary reports/screenshots and the upstream HEIC sample. No package, lockfile, tsconfig, dependency, secret or production environment change is required.

Migrations 001–010 are unchanged. No migration 011 or manual SQL/policy change is needed. The private asset route's conditional HTTP behaviour and matching proxy exception must ship together: authentication and the RLS file query happen before any 304. Original routes and errors remain no-store; no shared/public image cache or public bucket is introduced.

Reviewed together: normalized request-local caches/session deduplication; minimal layouts and removal of automatic client workspace fetch; server-selected batched People/material data and lean card props; deterministic source selection, small-only native lazy thumbnails and LQIP; richer Person sections and batched recollections; private revalidation; development-only privacy-safe operation/render/browser diagnostics; fixture counters/profiler and regression/browser coverage. Existing administration pages retain full workspace data and explicit mutation refreshes.

Validation: 84 regressions; production build/isolated decoder/3 browser flows; 4 authentication checks; 1 authenticated 1,007-item discoverability flow; 225 actual-SQL checks; lint, TypeScript and diff checks pass. Controlled query counts and hosted limitations are recorded in the release notes.

[Release, cache strategy and exact manual production smoke test](people-material-performance.md) · [validation](validation.md)
