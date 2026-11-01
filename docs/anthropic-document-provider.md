# Anthropic document provider — 1 November 2026

This adds an Anthropic Messages adapter to the existing `DocumentProvider` abstraction. OpenAI remains supported. `DOCUMENT_AI_PROVIDER` selects exactly one adapter; there is no fallback to another provider or model. No new migration, dependency, environment secret or production operation is introduced. Migrations 001–014 are unchanged.

## Configuration

For the selected provider, use server-only deployment variables:

```dotenv
DOCUMENT_AI_PROVIDER=anthropic
DOCUMENT_AI_MODEL=claude-sonnet-5-5
ANTHROPIC_API_KEY=<secure-server-secret>
```

The actual model comes from `DOCUMENT_AI_MODEL`, never a hard-coded model ID. `OPENAI_API_KEY` is not required for Anthropic. To select the retained OpenAI adapter, use `DOCUMENT_AI_PROVIDER=openai`, an appropriate configured model and `OPENAI_API_KEY`.

The environment-reading entry point imports `server-only`. Pure factories accept injected fetch/configuration for offline tests; they never read environment values. Keys are sent only in the HTTPS authorization header to the fixed provider endpoint, not in prompts, returned values, logs or client configuration. Redirects are rejected. Missing/blank/unsupported provider, missing selected key, invalid header whitespace or malformed model configuration returns the existing not-configured UI/API state. Authentication/account/model-access failures from Anthropic produce a sanitized interruption, retaining the traceable attempt and any saved pages. Local validation never reads the real key or verifies the live account/model entitlement.

## Request/response contract

Requests use `POST https://api.anthropic.com/v1/messages`, API version `2026-10-21`, JSON-schema output via `output_config.format`, a 10,000-token output ceiling and a 40-second request timeout. No SDK or SDK automatic retries are added. The adapter uses `thinking: {type: "between_tools"}` with no tools: Sonnet 5.5 documents this as its lowest thinking setting and rejects `disabled`. A different configured model must support the chosen request features; incompatibility fails without switching models. See [Messages API migration/header guide](https://platform.claude.com/docs/en/api/migration-2026-10-21), [Structured Outputs](https://platform.claude.com/docs/en/build-with-claude/structured-outputs) and [Sonnet 5.5 changes](https://platform.claude.com/docs/en/models/sonnet-5-5/whats-new-sonnet-5-5).

The existing orchestrator retains page order and sends one preserved page's verified private JPEG display copy per call as a base64 `image` block followed by the transcription prompt. It does not create a flattened master, public URL, external Files API upload or all-pages-at-once request. JPEG/PNG/WebP/GIF inline input is accepted; non-image URLs, malformed base64 and payloads above the direct API's documented 10 MB base64 limit are rejected before a call. The normal application pipeline supplies JPEG. See [Anthropic image input](https://platform.claude.com/docs/en/build-with-claude/vision).

Handwritten/typed reading uses the existing shared prompt/schema and bounded local validators: preserve source language/line breaks, `[unclear]` and uncertainty, no invented completion or face identification. After all source pages are saved, one text-only extraction receives the ordered page texts. Suggestions include People, Places, written/discussed dates, supported sender/recipient, restrained summary and topics. Page references and quoted evidence are checked against the actual source text. Enum kind casing is normalized; raw JSON remains unchanged. No suggestion establishes a canonical relationship without existing Editor review.

Only a complete assistant message with `stop_reason=end_turn` and valid text JSON is accepted. Refusal, token exhaustion, paused/tool responses, invalid envelopes, malformed JSON, over-limit payloads and ungrounded suggestions fail closed. Provider error bodies and transport-error text are never logged, returned or persisted.

Successful page/extraction output retains the complete bounded raw provider JSON as `rawResponse`, plus provider, requested/returned model, response ID, HTTP request ID, API version, stop reason and usage receipt. Existing migration 013 JSON fields store these values; the actual returned model also populates transcription/suggestion model provenance. Whole output is bounded conservatively below existing SQL limits (90,000 characters per page and 290,000 per extraction), leaving room for input provenance/JSON formatting. Oversized evidence is rejected rather than silently truncated. Error responses are deliberately not retained.

English translation reuses the selected run's frozen source text/review revision, sends **text only**, and stores a separate translation run/page output and raw receipt. It does not overwrite images, source transcription, prior AI output or human corrections. There is no second metadata-extraction call for translation.

## Preservation and cost controls

Uploads never invoke AI. The user explicitly confirms Transcribe and the page count. Existing 20-page limit, attempt IDs, source versions, exclusive active-run guard, page/extraction leases, durable cached-page reuse, late-save fencing, explicit resume/cancel and model/provider consistency checks remain unchanged. One two-page source run normally makes three calls: two page readings plus one extraction. A separately requested translation makes two text calls.

No automatic paid retry, provider fallback, bulk AI, face recognition or original/derivative write is added. A failed HTTP/provider request may already have been charged; explicit resume reuses saved pages but cannot guarantee exactly-once provider billing. Transcribe again creates a separate attempt. Changing provider/model requires a new attempt rather than silently resuming under different provenance. Human review remains required before canonical metadata is applied.

## Exact live acceptance test: one two-page letter

These are manual steps after an approved deployment of this code; none were performed by the agent.

1. Confirm the existing document schema (013) and deployed application's other prerequisites are already installed. **No new SQL is required for this adapter.** Confirm the three Production server variables above exist in Vercel without displaying their secret value. An environment change requires a deployment to reach a running build; do that only through your approved release process.
2. Use a disposable private archive and two synthetic, legible letter pages, ideally with handwritten/typed text, one deliberately illegible word, an explicit written date, sender, recipient and Place. For the translation check, use non-English source text. Download/hash the two originals before processing.
3. Upload/classify as one Letter with two ordered pages, or use an existing synthetic two-page Letter. Reload and verify images/order. Upload alone must leave it unprocessed and make no provider calls.
4. As an eligible Contributor or Editor, open Transcription and translation → Transcribe letter. Confirm **2 pages** and possible cost, then choose Transcribe these pages once. Do not repeatedly click or start another attempt while processing.
5. Check two source-language page drafts and uncertainty markers against their images. In Processing history confirm `anthropic`, configured `claude-sonnet-5-5`, returned model, timestamps, page file references and versions. Inspect authorized run output/receipts if needed, keeping source text and secrets out of logs/screenshots. The successful run should contain two page receipts and one extraction receipt.
6. Verify People/Place/date/sender/recipient/summary/topic suggestions are drafts and canonical metadata is unchanged. As Editor, correct one page, save/reload, and toggle the raw AI reading. Then deliberately approve only checked suggestions, reusing existing canonical IDs where appropriate.
7. If the synthetic source is non-English, explicitly request Translate into English. Verify two separate English page drafts, translation receipts and the retained source-text snapshot; source text/images must remain unchanged. This step incurs two additional text calls.
8. Reload and compare original downloads/SHA-256 with step 2. Confirm only explicit processing created calls/attempts. Check a signed-out visitor cannot access the letter or processing APIs. If any provider failure occurs, inspect the retained attempt and saved pages; decide explicitly whether to Resume (reuse saved pages) or Transcribe again (new history). Do not expose the API key while diagnosing.

Live transcription accuracy, account/model access, billing and hosted request duration remain manual acceptance gates. Automated tests use injected mock responses and loopback fixtures only. See [validation](validation.md) and [exact commit manifest](anthropic-provider-commit-manifest.md).
