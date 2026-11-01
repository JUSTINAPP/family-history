# Anthropic document adapter — exact proposed commit contents

Base `b61b455`. Review and commit only these 15 files. Nothing staged or committed by the agent.

- `.env.example`
- `README.md`
- `docs/anthropic-document-provider.md`
- `docs/anthropic-provider-commit-manifest.md`
- `docs/document-processing.md`
- `docs/validation.md`
- `scripts/test-documents.mjs`
- `scripts/test-preview-pipeline.mjs`
- `scripts/test-visibility.mjs`
- `src/lib/documents/anthropic-provider.ts`
- `src/lib/documents/provider-config.ts`
- `src/lib/documents/provider-core.ts`
- `src/lib/documents/provider.ts`
- `src/lib/documents/types.ts`
- `tests/anthropic-provider.spec.ts`

Exclude generated `next-env.d.ts`, which only reflects isolated `.next-test` route-type paths. Preserve its existing local change outside this commit. Also exclude `.env.local`, all real credentials, `.next*`, temporary fixtures and test reports. No migration 001–014, dependency or lockfile change is required.

The review covers the additive Anthropic transport, shared prompts/schemas with retained OpenAI behaviour, server-only selected-provider configuration, complete bounded raw JSON/receipts, offline provider/SQL persistence tests, both-key client-bundle exclusion and release documentation. No UI, original/master operation, canonical auto-application or automatic retry path is added.

See [validation](validation.md) and [configuration/exact two-page live acceptance test](anthropic-document-provider.md). No live API, production configuration, push or deployment was performed.
