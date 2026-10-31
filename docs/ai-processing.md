# AI processing and human review

## Backend foundation update

No AI service has been connected. The real schema includes empty transcriptions/metadata_suggestions tables and raw-vs-reviewed contracts, but real processing remains queued/off. Voice is still an example and is never persisted by the live upload adapter. There are no AI API keys or facial-recognition services. The provider-neutral design below remains future work.

## Current state

No AI vendor or API is connected. The sample transcription is fictional and does not transcribe the James Oldham scan. Processing steps are simulated. Corrections and comments remain in component memory; they do not modify fixtures or originals. This is visible in the interface.

## Provider boundary

`TranscriptionProvider` in `src/lib/types.ts` defines the initial vendor-neutral contract: signed source URLs, optional language and cancellation signal in; raw text, nullable confidence, provider/model and processing date out. A future server worker selects an adapter from configuration. Add adapters under a server-only module such as `src/server/transcription/providers/`, never call providers from the browser or iOS app. Provider credentials are server environment variables. Use an adapter-specific error mapping, timeouts, request limits and contract tests before connection.

Workflow: original file → safe processing derivative → provider transcription → raw output and confidence spans → human review → corrected version. Store immutable raw_ai_text, separate reviewed_text, review_status, provider, model, processed_at, reviewed_by/at and version. Null confidence means unavailable; do not invent percentages or combine incompatible provider scores. Text spans reference original page/file and coordinates where available. Preserve unclear words, line breaks and omissions. The human correction never overwrites the raw result; another model run creates a new version. Source viewer stays above or alongside machine text.

The six conceptual stages are optimising images, detecting pages, transcribing handwriting, finding dates and places, identifying possible people, and creating previews. The durable backend should represent stages independently: preview generation need not wait for AI, and a single failed stage should not block access to preserved originals. Raw output is untrusted input; escape it, bound output length, never execute it, and treat instructions appearing in letters as document content rather than system instructions.

## Metadata suggestions

Each candidate person, date, place, document type, relationship, event or tag becomes a `metadata_suggestions` row with input file/page reference, model, confidence if available, candidate value, and pending review status. Person candidates refer to archive-scoped IDs or remain unresolved strings. No cross-archive matching. A face match is not identification; require explicit review.

An editor review operation checks membership and revision, accepts/rejects the candidate, appends provenance, and optionally applies a canonical update in one transaction. Acceptance should default to uncertain or family_reported, not verified. Verification requires cited source evidence. An accepted candidate cannot overwrite a newer reviewed field: return a conflict and require review. Retain rejected, superseded and disputed candidates for audit. Worker credentials must be unable to modify verified fields or reviewed transcriptions.

## Privacy and operations

Before enabling a provider, choose data handling/retention, region, consent policy and per-archive opt-in. Send only needed processing copies through expiring URLs; do not send a whole private archive by default. Bound concurrency and cost per archive, use idempotency keys, cancellation, retry backoff and a dead-letter state. Log job IDs and timings, not private source text or access tokens.

## Future narrative and documentary work

Human or AI-assisted stories live in `stories`; ordered `story_items` references retain exact item, file/page, excerpt offsets and content revision for each claim or scene. Narration, transitions, generated scripts and their provider metadata are derived interpretations. They are never primary sources. Require review and label uncertainty/unsupported gaps. Later documentary render jobs can produce maps, still-image sequences and narration only from cited archive material; retain a manifest of every source and edit. Do not manufacture missing historical scenes, quotes, relationships or facts.

## Voice context and interpretation preview

The voice interaction now implements Ready to record, Recording, Paused, Recorded, Transcribing and Transcript ready states using a clearly labelled spoken example. Play/pause, re-record and edit transcript work locally. It never opens the microphone or invokes a speech service. The example WAV remains associated with the saved recollection and can be replayed/downloaded. Machine words and edited words are distinct fields in the session projection.

A future speech adapter should use the same raw/reviewed provenance rules as handwriting and return source timestamps/spans when available. Record provider/model, processed_at, confidence only when meaningful, language and input audio checksum. Preserve audio as an original, even if transcription fails. Transcribing an elderly family member is not the same task as handwriting OCR; keep provider modality/capability explicit rather than assuming one API does both well.

The optional “We found a few details” panel uses a deterministic local example recogniser, not AI. It previews names, a year, place and selected type from contributor context. Contributors can Confirm, Correct, Remove or Ignore for now, then save without reviewing every candidate. Original suggestion values and statuses are retained. No candidate overwrites quick details. Confirmed by contributor means **family recollection**, not verified historical fact. “Aunt Margaret” remains an unresolved possible identity until reviewed against evidence.

The future metadata service consumes source context with its evidence and uncertainty, creates pending suggestions and may never treat a speech transcript as error-free or convert “probably” into an exact date. Preserve the original spoken/written recollection, machine transcript, edited transcript and interpretation as separate layers. Confirming or correcting a suggestion appends provenance; editors decide when evidence supports verification.

`/archive/a-letter-from-home/review`, `/admin/processing` and a saved letter now provide an adjacent source/text comparison. Editors can inspect raw vs reviewed versions, correct per-page text and save a separate reviewed version. Source scans and raw sample text remain unchanged. The reviewed text is held in the root demo session. All sample handwriting text is fictional and is not a transcription of the shown files.
