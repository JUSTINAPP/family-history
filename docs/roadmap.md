# Roadmap

## 0 — Implemented visual foundation

Next.js App Router, TypeScript, Tailwind; editorial homepage; searchable/filterable fixture archive; source-first letter viewer with three scans, sample transcription, in-session correction and comments; people, places, family connections and a source-linked story; mobile photo/letter capture and batch review; JSON draft export. No account, upload, AI or backend persistence is implemented.

## 1 — A real private vertical slice (recommended next)

Set up a separate development Supabase project. Implement the documented UUID schema, archive memberships, invitations and RLS, with two-archive adversarial tests. Connect sign-in and one-photo ingestion: exact original preservation, verified receipt/checksum, a private display derivative, and persistent family-reported metadata. Prove backup/restore and denial of original overwrite. Make privacy real before adding real family records. Review the visual prototype with family members first.

## 2 — Multi-page and bulk durability

Resumable uploads, ordered letter/envelope records, background job queue, idempotency/outbox, safe image decoding, oriented/profile-normalised derived files, thumbnails, useful failure/retry UI, persistent draft and rapid review. Test hundreds of files and interruption recovery. Add contributors and editor workflows without requiring archival expertise.

## 3 — Reviewable assistance

Connect a provider adapter, evaluate handwriting against reviewed sample material, confidence spans, raw/reviewed version history and page-linked evidence. Add metadata suggestions and transactional human review. Test that worker roles cannot change verified assertions. Establish privacy/cost/retention agreements before sending material to vendors.

## 4 — Discovery and connections

Paginated PostgreSQL full-text search, indexed date ranges, richer people/places/events, audited family relationships, collections and comments. A person can be family, friend, other or unidentified. The family tree remains one projection. Semantic search comes only after sourced identity/date interpretation and access-aware retrieval.

## 5 — iOS capture

SwiftUI client using shared Auth/API/Storage, protected offline originals, resumable upload receipts and simple capture. Start with one image, then ordered letters and batches. No separate database or proprietary native-only content schema.

## 6 — Stories and documentaries

Editor-curated narratives with stable source citations and revision manifests. Later, reviewable AI-assisted sequences assembled from source material, clearly marked as interpretation. No fabricated historical footage or unsupported narration. Add search embeddings only after PostgreSQL search meets a measured need.

## Second pass — capture and stewardship UI implemented

The capture-first studio, mocked voice-state/playback/transcript editing, rapid capture, optional interpretation review, object views, background session jobs, saved-item view and adjacent letter review are now implemented. An editorial `/admin` area provides members, role/person linkage, invitation create/revoke/renew/mock-acceptance, suspension/removal with history retained, settings/ownership/export concepts, processing/retry and provenance activity. State survives internal navigation via a replaceable root provider. Voice/AI/auth/mail/storage are not connected, and reload resets the session.

The next implementation remains a private vertical slice: verified Auth/profile → archive membership/RLS → image **and audio** original receipt/checksum → durable context → nonblocking jobs → persistent human review. Do not add more mock breadth before proving isolation, interrupted capture recovery and backup/restore. Keep the voice source separate from speech text and interpretation from accepted metadata.
