# Ingestion and original preservation

## First persistent upload (current)

Real mode connects the existing capture preview and written context to private Storage/PostgreSQL. Save sends bounded original File bytes, the owning archive UUID and a stable capture UUID. The server verifies the user's Contributor membership, checks actual image signatures/count/size, computes SHA-256, and calls begin_ingestion to reserve UUID-only paths. Files upload without upsert. A retry compares the expected file hashes and can reuse existing matching bytes; mismatched sources cannot overwrite them.

complete_ingestion locks the item, validates Storage size/MIME receipts, marks originals stored, publishes the ready item and creates a durable display job in one SQL transaction. Written recollections are attributed separately. Ready items appear in real Explore and reload from the database. Upload failure retains local selection and recoverable database reservations. Repeating the capture UUID does not create another item/job. The database validates Storage receipts, while SHA/signature validation occurs in the app; direct native integrations must honour the same source-validation contract.

Original bytes are neither oriented, resized nor compressed in this stage. Authenticated private delivery shows the original until a separate derivative worker exists. No Storage UPDATE/DELETE policy is granted to ordinary clients. Three private buckets separate image originals, future derivatives and future audio. Jobs remain queued; no AI or worker progress is simulated in real mode. Voice remains a labelled example and is not persisted. Durable bulk/offline recovery and reservation administration remain later work.

Remote migration/account setup and actual hosted upload verification are still required; see supabase-setup.md. The older sections below retain design details and explicitly fictional demo flows.

## Retained visual demo (explicit demo mode)

Mobile camera/file inputs, image previews, multi-page ordering and envelope roles; simple human knowledge fields; exact, approximate, rough-year and unknown dates; local metadata export. Bulk folder/files/drop input, preview preparation progress, sequential Who / When / Where / Notes and Save & Next. Validation accepts JPEG, PNG, WebP, HEIC/HEIF up to 30 MB per image. Bulk batches are bounded to 500 images. Browser support for HEIC previews varies. No file is uploaded, rewritten or persistently stored. The processing animation is labelled as a simulation.

## Proposed durable pipeline

```
phone capture / file upload
    → authorise contributor membership
    → create ingestion session and reserved immutable object key
    → upload exact source bytes, without upsert
    → server verifies receipt, size, MIME signature and SHA-256
    → ORIGINAL PRESERVED (private archive-originals bucket)
    → transaction records immutable original + processing outbox
    → decode safely and read orientation / embedded metadata
    → orient a NEW working copy
    → normalise colour profile on a NEW copy where necessary
    → high-quality web display derivative
    → thumbnail / previews / transcription input derivatives
    → extract metadata with source attribution
    → AI analysis and suggestions
    → human review
```

Orientation correction, conversion, compression and profile changes must never overwrite source bytes. Derivatives link to original_file_id, pipeline version, transformation parameters and checksums. Original filename is display metadata, not a user-controlled storage path. Derivative existence is not proof an original has been safely received. Processing does not begin until verified original receipt and durable job enqueue.

## Originals and derivatives

Original bucket: `archive-originals/<archiveUUID>/<itemUUID>/<fileUUID>/<opaque-name>`; no upsert or client update/delete after receipt. Keep source EXIF, original encoding, dimensions and checksum. Restrict original download to authorised members and log exports where appropriate. Back up originals and run restore checks; database backups alone do not back up object storage.

Derived bucket: `archive-derived/<archiveUUID>/<itemUUID>/<originalUUID>/<pipelineVersion>/<role>.<format>`. Display images should preserve the complete material by default; any UI crop is reversible presentation, never a source edit. Produce responsive widths such as 640/1280/2000, moderate WebP/AVIF quality only after visual evaluation, and a small thumbnail. Keep high-quality JPEG/PNG alternatives when fine handwriting or transparency demands them. Strip GPS/device EXIF from delivery copies. Do not apply recolouring, beautification, restoration, generative fill, noise removal or sepia.

Letter files retain page_role (page, envelope_front, envelope_back), page_order, and contributor ordering. Machine-detected page segmentation is a suggestion; do not silently reorder originals. A separate transcription derivative may enhance legibility for machine input, but must be labelled and traceable; display the unaltered source as primary.

## Reliability and boundaries

Upload on-device originals with resumable transfers; persist an ingestion UUID and per-file receipts so mobile can retry. MIME declarations and client checks are usability hints: verify signatures, byte/dimension limits, malware, decompression bombs, orientation and safe decoders server-side. HEIC needs a licensed, supported server decoder; unsupported files should remain preserved and show a processing error, never disappear.

Atomic database writes and an outbox enqueue workers; storage and SQL cannot form one transaction. Reconcile orphan reservations and objects after a retention window. Worker stages use input checksum + pipeline version idempotency keys, leases, bounded retries and backoff. Derived uploads may retry under new/versioned keys. A failed derivative or AI request never deletes the original. Show queued/running/failed/retry/needs_review in UI. Use object lifecycle rules only for abandoned reservations and rebuildable derivatives, never originals. Destructive archival deletion is a separate audited admin operation with retention policy and clear user intent.

In the initial UI no persistence is implied. JSON export records metadata and ordered filenames/roles; original images must be kept separately. A future API will replace in-memory state with storage receipts and transactional records.

## Capture-first extension: the seven layers

CAPTURE → ORIGINAL → CONTEXT → PROCESS → SUGGEST → REVIEW → ARCHIVE.

Implemented UI now starts with Take photo / Upload existing, with Bulk upload secondary. The source is prominent after capture. “What do you know about this?” offers Record or Type instead, followed by optional People/When/Where/Item type; letters use Written by/Sent to plus date/place. Saving requires no metadata. Rapid mode returns to a camera-ready screen and attempts to open the native camera after Save & next. Letters group ordered pages/envelope sides; objects allow front/back/detail/inscription/other views.

Source images are native File handles, never modified. The mocked voice source is a labelled, locally generated example WAV; its raw transcript and contributor edits stay distinct. Saved captures and bulk-reviewed items enter the root session queue, visible under `/admin/processing`, without waiting for machine work. Closing/reloading still clears session state. Export and direct download of selected originals help evaluate the UX, but are not durable storage.

The future upload should quickly create an item **after server-verified original receipt**, then persist optional context independently. Queue originals/derivatives/speech/handwriting jobs through an outbox. The capture client returns immediately after durable acknowledgement; it must not wait for the eight letter processing stages. Expose queued / processing / needs_review / complete / failed, with failure scoped to a stage. Letter stages are Preserving originals, Optimising images, Detecting pages, Reading handwriting, Finding dates, Finding people, Finding places, Preparing transcription. Worker dependencies can run in parallel; this sequence is a user-facing conceptual model, not a requirement that every stage run serially.

Audio is retained as primary source in private original storage. Preserve MIME signature, bytes/checksum, duration/encoding and recorded_at. Create separate transcription derivatives only if needed. Prefer resumable uploads and offline protected capture sessions; never discard local audio after an AI result. Transcript edits and classifications do not rewrite audio. Consent, retention and archive export policies apply to spoken memories too.

No processing stage may beautify, restore, colourise, remove damage or generatively alter historical material. Orientation/profile corrections happen only in versioned display/processing derivatives; the exact original is still downloadable with permission.
