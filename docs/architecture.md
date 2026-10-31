# Architecture

## Implemented backend foundation (current)

Real mode now uses Supabase SSR cookie sessions, a Next.js 16 proxy, authenticated archive queries and narrow database RPCs. LiveSnapshot/LiveWorkspaceProvider adapts real data to the existing UI; the old WorkspaceProvider remains explicitly fictional demo-only. The current archive is selected by an HttpOnly cookie, validated through archive membership/RLS on every access. No global user role grants archive access.

Source capture goes through POST /api/v1/ingestions with either the web cookie session or an authenticated Bearer token (the shared boundary for future native clients). Server validation and hashing precede private Storage writes; begin/complete RPCs provide idempotent reservations and atomic item/context/job finalisation. GET /api/v1/files/:id rechecks auth/RLS and returns private/no-store original bytes, bypassing shared Next image optimisation. No service-role key or AI service is used.

The remote Auth endpoint is reachable. Remote schema/Storage policies are not installed yet; four SQL migrations are locally validated. Setup and first-account/archive instructions are in supabase-setup.md. The older design/proposal sections below remain roadmap context and are superseded where they describe this foundation as unconnected. Live routes do not show fictional fixtures. Display workers, invitations, audio and AI remain separate unconnected milestones.

## Original prototype stage (retained demo)

Implemented: Next.js App Router, TypeScript, Tailwind CSS v4, editorial responsive UI, typed representative data, local file previews, draft metadata exports, in-session comments and transcription corrections. There is no server persistence, authentication, AI request or upload endpoint. Public-domain demo assets are intentionally public under `public/`; real family files must never be placed there. Routes render without environment variables.

Proposed: Supabase Auth, PostgreSQL with archive-scoped RLS, private Storage, an authenticated ingestion API, durable processing workers, full-text search and human review. Nothing in `supabase/` is a deployed migration. Do not expose this prototype as a private vault.

## Application boundaries

- `src/app`: routes, server-rendered page composition, metadata and not-found handling.
- `src/components`: focused client interactions for search, capture, batch review and source viewing; shared source-image and editorial primitives.
- `src/lib/data.ts`: replaceable fictional dataset with stable UUIDs and route slugs. It is not a database.
- `src/lib/types.ts`: evidence, file-role, capture, person and transcription contracts.
- `src/lib/capture.ts`: local validation and metadata export. Never mutates source files.
- `public/images`: licensed illustrative scans, photographs and explicitly labelled specimens. See assets.md.

Future code should add repositories behind server routes rather than importing Supabase into every component. UUIDs are record identity; slugs are replaceable presentation identifiers. Person identity is separate from login profiles; being pictured does not require an account. Membership is scoped to an archive. The tree is a projection of relationship edges, never the root of the data model.

## Proposed shared API

Both web and native clients authenticate with Supabase Auth JWTs. Keep the following versioned, documented HTTP operations platform-neutral:

| Operation                                        | Responsibility                                                                                                                                                      |
| ------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `POST /api/v1/archives/:archiveId/ingestions`    | Check contributor membership, create idempotent draft item and per-file reservations. Return short-lived signed original-upload URLs.                               |
| `POST /api/v1/ingestions/:id/complete`           | Verify storage receipts, checksum, byte count and MIME signature; atomically finalise immutable originals and enqueue jobs. Never trust client-supplied completion. |
| `GET /api/v1/archives/:archiveId/items?cursor=…` | RLS-backed, paginated discovery; validated filters, text query and signed derived-image URLs.                                                                       |
| `PATCH /api/v1/items/:id`                        | Role and evidence checks, optimistic revision token, provenance append.                                                                                             |
| `GET /api/v1/items/:id/jobs`                     | Read permitted job states and retry availability.                                                                                                                   |
| `POST /api/v1/suggestions/:id/review`            | Editor/admin accepts or rejects a suggestion transactionally with provenance and a revision check.                                                                  |
| `POST /api/v1/transcriptions/:id/review`         | Save human-reviewed version without losing raw provider output or previous reviews.                                                                                 |

Use UUID idempotency keys scoped to archive + actor + operation, bounded payloads, opaque cursor pagination and a stable error envelope `{code, message, retryable, requestId}`. Storage keys are opaque and archive-scoped. Never accept an arbitrary fetch URL as an ingestion source. Service-role credentials stay in server workers. The web and iOS apps share the API and schema, not browser session state.

## Trust and privacy

RLS must be enabled before real data is inserted. Read and write policies must check active membership on the row's archive. Storage reads require signed, expiring URLs and the same membership checks. Original objects are never publicly addressable. Revoke membership server-side and avoid shared caching of private pages or URLs. Contributions are family reports, not automatically verified facts. Machine workers can add suggestions and derivatives, never edit verified assertions.

Next.js image optimisation is appropriate for public demo assets. For private material use membership-gated, short-lived derived URLs and private caching; never proxy originals through a public, shared image cache. Strip location/device EXIF from display derivatives while retaining the untouched original for authorised access.

## Search and growth

Start with PostgreSQL full-text search: stored/generated `tsvector` fields or a search-document projection over titles, notes, reviewed transcriptions, tags, people and places, GIN indexes, archive-scoped filters and keyset pagination. Preserve approximate dates as ranges with precision and evidence, rather than making up January 1. Materialise cross-table search records asynchronously after writes; RLS applies to the search projection too. Search snippets from AI text must retain review status.

Later, add pgvector embeddings in a separate `search_embeddings` table keyed to archive, source record, content revision, model and chunk offsets. Membership filters apply before returning any semantic result. “Janice before she was 25” needs person disambiguation, a sourced birth-date range and temporal filtering, not an ungrounded generated answer. Unknown dates must stay unknown. Native search and embeddings are not implemented now.

## Operations to add before real use

Test RLS with multiple archives and every role, verify backup and original restore, configure storage limits, invitation/account recovery and observability, scan uploads, implement durable retries, and add audit retention and deletion procedures. Private data must not reach public demo fixtures, analytics or error logs. No implementation here requires or includes credentials.

## Capture and stewardship extension

The second UI pass adds a root `WorkspaceProvider` as a **mock repository boundary**. It scopes members/invitations/captures to the current archive UUID and keeps source File handles, audio references and reviewed text alive across internal navigation. The app still needs no credentials. Refresh clears the session. No private route is enforced by a server: `/admin` demonstrates private administration but is labelled as an access preview.

New code: `workspace-types.ts` models captures, recollections, suggestions, membership/invitation states and activities; `permissions.ts` centralises cumulative role descriptions; `demo-workspace.ts` provides replaceable fixtures. `VoiceRecollection`, `SuggestionPreview`, `TranscriptionReview`, `SavedCapture` and `components/admin/` are UI boundaries that can later call repositories. The initial archive/discovery design is retained.

Use CAPTURE → ORIGINAL → CONTEXT → PROCESS → SUGGEST → REVIEW → ARCHIVE as distinct resources, not one editable metadata blob. The server creates an item as soon as original receipt is verified, returning item and job IDs. Recollection audio is another immutable original. Its speech transcript, edited transcript and extracted suggestions are independent records. Page/role order is mutable metadata, never a source rewrite. Save & next must not await OCR, transcription or metadata analysis.

Extend the versioned API with archive-scoped member/invitation/settings/activity endpoints; recollection/audio upload reservations; job subscriptions/polling; and authenticated full-export jobs. `POST /api/v1/invitations/:id/redeem` must verify the authenticated email and consume a hashed, expiring single-use token transactionally. User identity, historical person identity and archive membership remain separate. UI preview-role state is never trusted by these endpoints.

Queue states exposed to clients: `queued`, `processing`, `needs_review`, `complete`, `failed`. Internally retain leases, retries, attempt IDs and stage-specific error details. Original receipt is a durable prerequisite; a UI “saved” toast must never stand in for it. In the current demo the toast says saved **in this session** and the processing sequence is explicitly simulated.

See [permissions](permissions.md), [product architecture](product-architecture.md) and the data-model extension for enforcement, platform boundaries and record relationships. Real integration should begin with Auth/membership isolation and immutable image/audio receipt, not with AI.

## Archive identity and active context

The top-level domain entity is now `Archive`, independent of family subject matter. The initial archive is The Allen & Cork Archive. Its identity (UUID/name/slug/description/cover/owner/created date/privacy) is separate from its nested processing and default-permission settings. Members, invitations, captures, fixture people/items/places/stories, jobs and activity carry the owning archive ID. Session review/role-preview state is partitioned by active archive UUID; mutations stamp/check that archive. The UI selects from membership-accessible archives via a restrained header control; only one is provisioned now.

Admin settings changes name, description, cover, private mode and future invitation defaults, with links to member/permission management. Created time and UUID stay immutable. Rename does not change the slug; slug edits are explicit. Privacy supports owner_only and members_only as a role-policy ceiling, not a public-sharing setting. The demo still has no authentication or real private server access.

One account may own or join multiple archives with independent membership roles. Historical Person identity remains local content, separate from member/profile identity. Before enabling more real archives, scope all repositories and server-rendered routes to a server-authorised archive ID; never rely on the switcher, URL slug, contributor ID or an in-memory filter for isolation. Add archive-qualified routes/cache keys, safe draft handling and cancellation of in-flight prior-archive work. See product-architecture.md and data-model.md for the exact entity/ownership contract and implementation limits.
