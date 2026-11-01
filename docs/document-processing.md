# Letters, documents and optional AI — release 013

A letter, postcard, certificate or document is one historical object with ordered individual images. Add photographs keeps its independent-item bulk behaviour. Add a letter or document supports phone capture/existing images, optional front/back/envelope labels, adding/removing pages and move controls before saving. Add an object retains multiple views; Record a memory keeps the audio workflow.

Each image keeps its own immutable original, SHA-256 and private Storage receipt. Nothing flattens the masters into a PDF/image. Saved documents have responsive page images, thumbnails, previous/next, enlargement and permitted original downloads. Editors can reorder saved pages without changing original bytes/paths; old processing attempts retain their original order. Existing saved documents can be processed without re-upload.

## Optional processing and review

Transcribe letter/document is explicit. Its confirmation states the page count and that copies will be sent to the configured service at possible cost. Uploads never invoke AI. Transcribe again creates a new traceable attempt. The current limit is 20 pages per attempt. Processing is sequential, with one image reading per page and one text-only extraction for a source transcription. Translation makes one text-only call per page, with no second extraction.

Desktop review places page and text beside one another; mobile stacks them. Raw AI text remains separate from revision-checked human corrections, including before/after audit. `[unclear]` and structured uncertainty are preserved. Empty/unwritten pages may have empty transcription. Human review is still needed for handwriting, language, dates and factual interpretation.

Translate into English is separately requested from a source attempt. It freezes the selected source text and correction revision for each page; later corrections cannot silently change that translation's input. Images, source text and English text remain separate. Processing history retains provider/requested model, resolved response model/usage receipt, source checksums/order, actual input image provenance, timestamps, page text versions and failures. Technical details sit under Processing history.

AI suggestions stay drafts. Every choice starts unchecked; possible People/Places matches do not select or link a canonical record. An Editor deliberately chooses an existing ID or explicitly creates a minimal new record. Normalized exact-name duplicate creation is blocked; ambiguous/similar names still require human judgment. People roles distinguish mentioned/sender/recipient; Places distinguish related/written-in/sent-to. No facial recognition is implemented. Written date requires a chosen valid precision and optimistic expected-date check; discussed/uncertain dates remain context. Approved summaries/topics remain reviewed metadata, separate from historical notes and raw AI output.

Explore searches latest human-reviewed source text per original, alongside existing catalogue text. AI drafts and English translations are excluded. Person/Place filters continue to use actual relationships, not word matches. This is application text search, not a new full-text index or semantic-search service.

## Provider and permission boundary

The narrow `DocumentProvider` interface exposes page reading and structured extraction. The initial adapter is OpenAI Responses with image inputs and strict Structured Outputs; Anthropic is a future adapter, not implemented or required. The server sends `store:false`; that is not a claim of zero provider retention. See the official [image-input guide](https://developers.openai.com/api/docs/guides/images-vision) and [Structured Outputs guide](https://developers.openai.com/api/docs/guides/structured-outputs?api-mode=responses).

Only server variables configure AI:

```dotenv
DOCUMENT_AI_PROVIDER=openai
DOCUMENT_AI_MODEL=<explicit-account-approved-vision-and-structured-output-model-id>
OPENAI_API_KEY=<server-secret>
```

`.env.example` has empty placeholders, including a clearly reserved `ANTHROPIC_API_KEY`. Never use `NEXT_PUBLIC_` for AI secrets or commit `.env.local`. No model is silently selected. Missing/unsupported provider, model or key produces a clear not-configured state; reading preserved images and reviewing saved drafts still works.

The existing session, same-origin API checks and user-scoped Supabase client remain. No service-role credential is introduced. Eligible Contributors may process their own ready, active, unarchived and unverified documents; Editors may process eligible archive documents. Only Editors correct transcription or apply suggestions. Readers see only RLS-readable items/runs. SQL functions independently check permissions, source versions and lifecycle. Direct authenticated writes remain revoked except narrow RPCs.

Request IDs avoid duplicate starts; per-page/extraction claims fence concurrent or late responses. Explicit resume reuses durable page receipts. No automatic paid retries, automatic bulk processing or distributed background worker is added. An interrupted paid call may have been charged before a durable receipt was saved; retry cannot promise exactly-once billing. Requests run in the server request lifecycle with a 60-second route duration; slow/provider-hosted behaviour needs acceptance testing. Cancellation retains drafts and rejects late saves.

## Schema and manual Supabase action

**New migration: `202611010013_document_processing.sql`.** The user approved 013 because 012 is already committed and may be installed. Migrations 001–012 are unchanged. `document_runs` records attempts; existing transcriptions, metadata_suggestions, processing_jobs and provenance hold their respective outputs and reviews. Existing lifecycle/deletion preflight is extended to recognize these reviewed dependencies and block unknown future dependencies before Storage cleanup. No historical content backfill, original rewrite, Storage deletion or AI call occurs during installation.

Before any release, establish the actual live 001–012 baseline; do not assume local migration files imply remote installation. Apply only missing migrations in their reviewed order, never rerun installed SQL. Once the baseline is confirmed, a human manually applies the full 013 file in Supabase SQL Editor before deploying the app. It is enclosed in BEGIN/COMMIT; an error aborts the transaction. Do not run isolated statements or remove transaction boundaries. This agent has not queried or modified production.

Read-only installation markers (presence alone does not prove complete definitions/grants):

```sql
select to_regclass('public.document_runs') as runs,
       to_regprocedure('public.begin_document_run(uuid,uuid,text,text,uuid,text,text)') as begin_run;
select column_name from information_schema.columns
where table_schema='public' and table_name='transcriptions'
  and column_name in ('document_run_id','page_order_snapshot','output_kind','review_revision');
```

Inspect the exact function signature in 013 if comparing an independently modified deployment. Keep secrets out of SQL Editor scripts.

## Exact production smoke test after an approved deployment

Use a disposable archive and synthetic typed/handwritten pages; start with AI unconfigured.

1. Add two separate photographs: confirm two items. Add a two-sided Letter and a four-page Letter: confirm one item each, correct page labels/order after reload, and unchanged original-download SHA-256 checksums.
2. Read both letters on desktop and a phone: thumbnails, previous/next, enlarge/fit and original downloads. Reorder the saved four-page letter; reload and check order/checksums.
3. Open Transcribe letter with no server configuration: clear unavailable state, no processing run, preserved reader still usable. Check existing photographs, audio, Quick catalogue, People/Places and conversation.
4. Configure only the selected server provider/model/key, restart/redeploy as approved, then confirm transcription of one synthetic letter. Check explicit page count, real response/model/usage receipts, page-level source IDs/order and `[unclear]` behaviour. Confirm no Person/Place links or date changes occur before review.
5. Correct one source page, save/reload, then toggle original AI draft. Verify distinct text and revision/audit. Search a word present only in reviewed text in Explore; confirm relational Place filtering still requires a real link.
6. Review selected Person/Place suggestions using existing IDs; verify no duplicate records, correct sender/recipient/mentioned and Place roles, valid written date precision, retained discussed-date context and reviewed summary/topics. Leave other suggestions unapplied.
7. Request English translation of a non-English synthetic letter. Verify source/translation/image separation and frozen input text. Correct source afterwards and confirm earlier translation retains its prior input snapshot.
8. Transcribe again; inspect both attempts. Interrupt/resume one attempt and verify completed pages are reused; double submission/cancellation must not save late duplicate pages. Note possible provider charges for interrupted requests.
9. As Viewer, another archive's member and signed-out visitor, verify processing/review/cross-archive APIs and private images deny unauthorized actions. As eligible Contributor, verify own-document processing but no Editor correction/application controls.
10. Archive a disposable document only after processing stops; use existing confirmed deletion, then verify Storage/row cleanup and preserved directory People/Places. Check phone reading/review and actual hosted request durations. Never use valuable family material for destructive smoke tests.

## First provider connection: exact next step

Keep AI disabled until the schema/app release is approved. Choose an OpenAI account-approved model that supports both image input and strict Structured Outputs, put the three variables above in ignored local server configuration, and restart the local app. Run one synthetic two-page letter through explicit transcription and human review, checking actual receipts, uncertainty and cancellation. No live model request has been tested in this release; accuracy, latency, permissions/limits and billing remain acceptance gates before enabling family-material processing. Configure equivalent hosted server secrets only after that acceptance and explicit release approval.

See [final validation](validation.md) and [exact commit manifest](document-processing-commit-manifest.md).
