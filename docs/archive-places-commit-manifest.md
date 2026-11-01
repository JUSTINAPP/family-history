# Archive Places — exact proposed commit

Base: `40eac12`. Include these 35 files together. Nothing was staged, committed, pushed, deployed or applied remotely by the agent.

```text
README.md
docs/archive-places-commit-manifest.md
docs/archive-places.md
docs/validation.md
scripts/test-database.mjs
scripts/test-places.mjs
src/app/archive/[slug]/edit/page.tsx
src/app/explore/page.tsx
src/app/globals.css
src/app/places/[slug]/page.tsx
src/app/places/page.tsx
src/components/catalogue.ts
src/components/explore.tsx
src/components/live/development-performance.tsx
src/components/live/item-editor.tsx
src/components/live/item-places.tsx
src/components/live/live-item.tsx
src/components/live/live-workspace.tsx
src/components/live/place-editor.tsx
src/components/live/place-picker.tsx
src/components/live/places-overview.tsx
src/components/live/session-layout.tsx
src/components/workspace-provider.tsx
src/lib/backend/performance.ts
src/lib/backend/place-actions.ts
src/lib/backend/places.ts
src/lib/backend/repository.ts
src/lib/places.ts
src/lib/types.ts
supabase/README.md
supabase/migrations/202611010011_archive_places.sql
tests/fixtures/visibility-server.mjs
tests/live-auth.spec.ts
tests/places.spec.ts
tests/preview-pipeline-browser.spec.ts
```

Exclude generated `next-env.d.ts` (test build type-path changes only), `.env.local`, `.next*`, generated codecs, temporary HEIC samples, screenshots, logs and Playwright output. No package, lockfile, tsconfig, mapping provider, dependency or secret change is needed.

Migration 011 is the only schema change. Files 001–010 are unchanged. 011 adds archive-local Places/associations, forced RLS, scoped RPCs, relevant indexes and the existing lifecycle guard on new links. It explicitly updates deletion preflight to recognize this reviewed cascade child and reject future unknown dependencies before Storage cleanup. Final item deletion cascades association rows, retaining Place records. No automatic Where-text conversion, data seed, global directory, new Storage policy or original mutation is introduced.

Review as one release: schema/permissions/provenance; archive-scoped batched reads; Place directory/create/edit/picker/inline flow; shared real-material stacks; relational Place detail/People connections and Explore filtering; preserved legacy Where evidence; deletion/split compatibility; actual database, browser and retained regression coverage.

Validation: 261 database checks (234 with audio initially absent), 86 regressions, production build/isolated decoder/4 browser flows, 4 authentication tests, 1 authenticated 1,007-item discoverability flow, lint, strict TypeScript and diff checks pass. Hosted Supabase/Vercel and physical iPhone/Safari remain manual acceptance checks.

[Model, manual migration action and exact production smoke test](archive-places.md) · [validation](validation.md)
