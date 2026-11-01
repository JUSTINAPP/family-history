# Quick catalogue / family conversation — exact proposed commit

Base: `6210226`. Include these 32 files together. Only migration 012 is new; do not include changes to 001–011. Nothing was staged, committed, pushed, deployed or applied remotely by the agent.

```text
README.md
docs/quick-catalogue-conversation-commit-manifest.md
docs/quick-catalogue-conversation.md
docs/validation.md
scripts/test-conversation.mjs
scripts/test-database.mjs
src/app/explore/page.tsx
src/app/globals.css
src/app/quick-catalogue/page.tsx
src/components/archive-image.tsx
src/components/live/family-conversation.tsx
src/components/live/identification-form.tsx
src/components/live/item-editor.tsx
src/components/live/item-places.tsx
src/components/live/live-item.tsx
src/components/live/place-picker.tsx
src/components/live/quick-catalogue.tsx
src/components/live/quick-field.tsx
src/components/live/session-layout.tsx
src/lib/backend/catalogue.ts
src/lib/backend/quick-actions.ts
src/lib/backend/quick-catalogue.ts
src/lib/backend/repository.ts
src/lib/conversation.ts
src/lib/types.ts
supabase/README.md
supabase/migrations/202611010012_quick_catalogue_and_conversation.sql
tests/conversation.spec.ts
tests/fixtures/visibility-server.mjs
tests/live-auth.spec.ts
tests/preview-pipeline-browser.spec.ts
tests/visibility-browser.spec.ts
```

Exclude `next-env.d.ts`: this was already modified before the task and changes only generated development/build route references. No environment/credential file, package/lockfile, generated build output, test result, screenshot or original image sample belongs in this commit.

[Release/permissions/manual migration and production smoke test](quick-catalogue-conversation.md) · [validation](validation.md).
