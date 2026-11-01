# Inline Family Conversation — exact proposed commit contents

Base `b9ffcc8`. Review and commit only these 17 files. Nothing staged or committed by the agent.

- `README.md`
- `docs/inline-conversation-commit-manifest.md`
- `docs/inline-family-conversation.md`
- `docs/validation.md`
- `src/app/api/v1/conversations/[id]/route.ts`
- `src/app/globals.css`
- `src/components/explore.tsx`
- `src/components/live/conversation-cache.tsx`
- `src/components/live/family-conversation.tsx`
- `src/components/live/inline-conversation.tsx`
- `src/components/live/live-workspace.tsx`
- `src/components/live/quick-catalogue.tsx`
- `src/components/ui.tsx`
- `src/lib/backend/quick-actions.ts`
- `tests/fixtures/visibility-server.mjs`
- `tests/live-auth.spec.ts`
- `tests/preview-pipeline-browser.spec.ts`

Exclude generated `next-env.d.ts`, which reflects isolated `.next-test` route types. Preserve its existing local change outside this commit. Also exclude `.env.local`, `.next*`, temporary screenshots/fixtures and test reports. No migration 001–014, dependency/lockfile or environment change is required.

Review covers the existing shared conversation/composer, lazy authenticated item-scoped read endpoint, archive/session cache, canonical saved-row updates, stable live Explore card rows and button semantics, retained Home deep links, author/revision/role enforcement, existing Editor recollection promotion, tests and documentation. No second comments model, reactions, automatic canonical metadata or production action is added.

See [validation](validation.md) and [interaction/manual release/exact production smoke test](inline-family-conversation.md). No push or deployment was performed.
