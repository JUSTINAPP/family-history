# Capture-first correction — exact proposed commit contents

Base `4a7eea5`. Review and commit only these 19 files. Nothing staged or committed by the agent.

- `README.md`
- `docs/capture-first-commit-manifest.md`
- `docs/capture-first.md`
- `docs/item-classification-and-transcription.md`
- `docs/validation.md`
- `src/app/globals.css`
- `src/components/admin/processing.tsx`
- `src/components/capture.tsx`
- `src/components/live/bulk-import.tsx`
- `src/components/live/document-actions.tsx`
- `src/components/live/live-item.tsx`
- `src/components/saved-capture.tsx`
- `src/components/workspace-provider.tsx`
- `src/lib/demo-workspace.ts`
- `tests/archive.spec.ts`
- `tests/bulk-intention.spec.ts`
- `tests/capture-admin.spec.ts`
- `tests/heic-preview.spec.ts`
- `tests/preview-pipeline-browser.spec.ts`

Exclude generated `next-env.d.ts`: it points at isolated test-build route types and is not needed for this release. Preserve its existing local change outside this commit. Exclude `.env.local`, `.next*`, temporary fixtures/screenshots and test reports. No migration, package/lockfile or environment change belongs in this commit.

Review covers the removed pre-file intention gate, local material-first selection and neutral Other saves, embedded independent-photograph import with existing retry/resume IDs, grouped ordered documents/objects and explicit photograph front/back, capture-another behavior, source-first saved-document layout and restrained transcription links. Demo processing now simulates preservation/previews only; real audio and live document/provider/review pipelines remain unchanged. Tests follow the new interaction and retain permissions, import, source-byte, document-history, mobile and accessibility assertions.

All migrations 001–015, backend ingestion/Storage primitives, provider adapters and dependencies are unchanged. See [final validation](validation.md) and [release limits/exact production smoke procedure](capture-first.md). No production SQL/data access, live provider call, push or deployment was performed.
