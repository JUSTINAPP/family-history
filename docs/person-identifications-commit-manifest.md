# Person relationships / split UX — exact files to commit

Base commit: `8df781c`. Include these 26 files together. The starting tree contained only the generated `next-env.d.ts` modification. No staging, commit, push, deployment or production SQL change was performed by the agent.

```text
README.md
docs/person-identifications-commit-manifest.md
docs/person-identifications.md
docs/validation.md
scripts/test-database.mjs
scripts/test-person-identifications.mjs
src/app/archive/[slug]/edit/page.tsx
src/app/archive/[slug]/manage/page.tsx
src/app/explore/page.tsx
src/app/globals.css
src/app/people/[slug]/page.tsx
src/components/explore.tsx
src/components/live/identification-form.tsx
src/components/live/item-editor.tsx
src/components/live/item-manager.tsx
src/components/live/live-item.tsx
src/lib/backend/identification-actions.ts
src/lib/backend/management-actions.ts
src/lib/backend/repository.ts
src/lib/identifications.ts
supabase/README.md
supabase/migrations/202611010010_person_identifications.sql
tests/fixtures/visibility-server.mjs
tests/person-identifications.spec.ts
tests/preview-pipeline-browser.spec.ts
tests/visibility-browser.spec.ts
```

Exclude `next-env.d.ts`: its only diff points to generated `.next-test` route types. Also exclude environment files, generated codecs, `.next*`, test outputs, temporary logs and the upstream HEIC sample. No package, lockfile, secret or tsconfig change is needed.

Migrations 001–009 are unchanged. 010 is the only new migration. The existing identifications table is reused; there is no automatic name-to-Person backfill and no new public Storage policy. Same-archive foreign keys, restricted RPCs, existing RLS and lifecycle triggers protect the new mutations. Original report fields remain intact; removal is a retained inactive report, not Person deletion. The existing 009 split SQL remains responsible for source/derivative preservation and parent-context retention.

Reviewed together: schema/RPC permissions and provenance, paginated relationship reads, Person picker/inline creation, Person page cards, strict relational Explore filtering, explicit split context choice, independent catalogue controls, fixtures and actual database/browser coverage. Final results: 225 database checks (198 with audio initially absent), 79 regressions, 2 authenticated production integration flows, 4 authentication tests, 1 authenticated 1,007-item discoverability flow, build/isolated decoder, lint, TypeScript and diff checks pass.

[Release, manual Supabase action and production smoke test](person-identifications.md) · [validation and limits](validation.md)
