# Future iOS companion

## Shared persistent foundation (current)

The native app remains unbuilt. The new schema/Auth/Storage/RPC boundaries are platform-neutral: a native client can authenticate with the same Supabase project, use its JWT/memberships, reserve a capture, upload exact bytes to the permitted private paths and finalise receipts. The Next API also accepts a Supabase Bearer token; no service-role key belongs in either client. Cookie session handling is a web transport detail, not a database assumption.

Source reservations, UUID capture idempotency keys, role/ownership checks, recollections and durable processing jobs are shared. A native implementation must validate source signatures, hash unchanged bytes, obey limits, keep originals until durable receipt and handle interrupted/repeated uploads. No AI is required for capture. Audio buckets/tables are prepared but actual voice upload is not yet enabled; never send the website's spoken example as historical testimony.

No iOS application is built in this version.

Web: archive, discovery, editing and storytelling. iOS: quick capture, with the same Supabase Auth identities, archive memberships, PostgreSQL records, private Storage and processing_jobs. Both clients use the versioned ingestion/review boundaries in architecture.md. Do not put service-role or AI keys in either client. A historical person is not an auth profile.

Proposed SwiftUI loop: sign in → select authorised archive → photograph photo/letter/object → choose kind → optionally identify people → rough year or date with uncertainty → place → notes → upload → continue capturing. A letter session groups ordered pages and optional envelope front/back. Preserve original capture bytes before any on-device preview processing. Human knowledge is saved as family_reported.

Use AVFoundation/PhotosPicker with explicit camera/photo permissions; upload HEIC originals when produced by the device. Preview JPEGs are derivatives and cannot replace originals. Store offline capture sessions and original files in application-protected local storage, with upload receipts, UUID idempotency keys and retry state. Use Keychain-backed auth tokens, resumable/background upload where supported, and explicit status for waiting, transferring, preserved, processing and needs_review.

Do not delete the local original until the server confirms checksum-verified receipt. Define device retention after upload, revoke tokens cleanly on logout and prevent pending drafts from leaking across archive/account switches. Avoid storing private image data in unprotected caches or logs. Conflicts return the current server revision; never silently replace reviewed metadata during sync.

The first native milestone should prove a complete one-image upload/receipt/retry cycle against the same backend as the web. Add multi-page capture and offline batches after durable original preservation, membership isolation and recovery are tested.

## Capture-first product direction

The primary native responsibilities are CAPTURE, VOICE, UPLOAD, QUICK IDENTIFICATION and RAPID CAPTURE. The web is responsible for DISCOVERY, ARCHIVE MANAGEMENT, DETAILED EDITING, TRANSCRIPTION REVIEW, FAMILY TREE, TIMELINES, STORIES and ADMINISTRATION. Both use the same Auth/profile, per-archive memberships, source storage, recollections, processing jobs and review contracts. Historical people never determine app permissions.

The practical native loop becomes take photo → record a short recollection → save → next. Use large accessible recording controls with ready/recording/paused/recorded/transcribing/transcript-ready states, playback and re-record. Voice transcription and interpretation must not block continued capture. Keep raw audio in protected local storage until its exact-byte server receipt is verified. A corrected speech transcript is a new layer, not permission to delete audio.

Rapid capture should restore camera readiness without cataloguing forms, count saved items and allow interruption/resume. Provide optional People / When / Where / Type and a later review inbox; letters preserve ordered pages plus envelope sides. Objects group multiple views. Native uploads use idempotency keys and file receipts, separating original preservation from asynchronous machine processing. An offline draft remains clearly unsynced until durable acknowledgement. Accessibility testing must include VoiceOver, large Dynamic Type, motor-friendly targets, actual devices and meaningful feedback for microphone/photo permission denial.

The current website demonstrates these flows using a spoken example and browser File previews. There is no native app or real microphone integration in this pass.
