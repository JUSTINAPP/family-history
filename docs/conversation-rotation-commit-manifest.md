# Conversation access and rotation — exact proposed commit contents

Base `494864c`. Commit only these 31 files after review. Nothing has been staged or committed by the agent.

- `README.md`
- `docs/conversation-and-image-rotation.md`
- `docs/conversation-rotation-commit-manifest.md`
- `docs/validation.md`
- `scripts/test-database.mjs`
- `scripts/test-image-rotation.mjs`
- `src/app/api/v1/previews/[id]/route.ts`
- `src/app/explore/page.tsx`
- `src/app/globals.css`
- `src/components/archive-image.tsx`
- `src/components/conversation-link.tsx`
- `src/components/explore.tsx`
- `src/components/live/document-reader.tsx`
- `src/components/live/family-conversation.tsx`
- `src/components/live/image-options.tsx`
- `src/components/live/live-home.tsx`
- `src/components/live/live-item.tsx`
- `src/components/live/quick-catalogue.tsx`
- `src/components/person-material-stack.tsx`
- `src/components/ui.tsx`
- `src/lib/backend/catalogue.ts`
- `src/lib/backend/image-actions.ts`
- `src/lib/backend/repository.ts`
- `src/lib/preview/types.ts`
- `src/lib/types.ts`
- `supabase/README.md`
- `supabase/migrations/202611010014_image_rotation_and_conversation_counts.sql`
- `tests/fixtures/visibility-server.mjs`
- `tests/image-rotation.spec.ts`
- `tests/preview-bulk.spec.ts`
- `tests/preview-pipeline-browser.spec.ts`

Exclude generated `next-env.d.ts`: it points at the isolated `.next-test` route types and is unrelated to this feature. Preserve the local generated change outside this commit. Also exclude `.env.local`, `.next*`, temporary fixtures, screenshots and test reports. No dependency/lockfile or migration 001–013 change is required.

Review covers existing conversation/Quick Catalogue exposure, one aggregate count view, narrow rotation metadata/RPC/action, shared image/LQIP rendering and stack aspect ratio, immutable originals/derivatives, permissions, tests and release documentation. The original image endpoints and their private caching policy are retained. No live service, production SQL, push or deployment was used.

See [final validation](validation.md) and [release/manual Supabase action/exact smoke test](conversation-and-image-rotation.md).
