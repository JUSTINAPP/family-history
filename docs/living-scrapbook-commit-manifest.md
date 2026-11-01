# Living scrapbook — exact proposed commit

Base: `5803ed6`. Include these 22 files together. Places and migration 011 are already in the base commit; no migration is included here. Nothing has been staged, committed, pushed, deployed or applied remotely by the agent.

```text
README.md
docs/living-scrapbook-commit-manifest.md
docs/living-scrapbook.md
docs/validation.md
src/app/archive/[slug]/manage/page.tsx
src/app/globals.css
src/components/live/item-manager.tsx
src/components/live/live-home.tsx
src/components/live/live-item.tsx
src/components/live/shared-context-review.tsx
src/lib/backend/catalogue.ts
src/lib/backend/management-actions.ts
src/lib/backend/places.ts
src/lib/backend/repository.ts
src/lib/backend/shared-context-actions.ts
src/lib/catalogue-presentation.ts
src/lib/home-material.ts
src/lib/types.ts
supabase/README.md
tests/catalogue-scrapbook.spec.ts
tests/fixtures/visibility-server.mjs
tests/preview-pipeline-browser.spec.ts
```

Exclude `next-env.d.ts`: it is a pre-existing generated development/build-path change and this release does not require committing it. No environment or credential file, test output, image sample, generated build artifact, package/lockfile or old migration belongs in this commit.

[Release behavior, validation and exact manual production smoke test](living-scrapbook.md).
