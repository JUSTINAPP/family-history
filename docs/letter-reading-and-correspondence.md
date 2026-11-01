# Letter reading, correspondence and private page performance — release 016

Base `5edd775`. The existing document/provider/transcription architecture is retained. No production access, real family-file access, live AI request, commit, push or deployment was performed. No environment variable or dependency change is required. The user’s successful live Anthropic transcription is the starting context, not an automated test result from this pass.

## Letter identity and human decisions

Letter detail now uses LETTER, a derived correspondence title and a readable date. From, To, Date and Place have a dedicated visible section. From/To link canonical People where an accepted role relationship exists. Written-from Places take precedence over generic primary/related Place links; a known country is displayed with the Place. The existing People/date/Place controls and conversation/recollection sections remain available.

Existing `identifications.role_context` holds sender, recipient and mentioned roles. Existing accepted `metadata_suggestions.reviewed_value` holds the reviewed wording, optional canonical ID and explicit text-only decision. Original `suggested_value`, proposed-name reports, raw provider output and provenance remain separate. Pending AI names never become Letter facts. Accepted canonical names require a still-accepted role association; removing that association does not resurrect an old canonical suggestion as fact. The newest accepted decision supplies a role’s reviewed wording; the underlying history is retained.

From/To confirmation can keep reviewed text without creating a Person. To link Jan Allen, choose Change on From, select the existing Person, then Confirm. To keep Tina as text, Confirm the reviewed To value without selecting/creating a Person. Change also offers deliberate Person creation; duplicate-name safeguards remain in the existing primitive. People mentioned still require an explicit canonical link/create decision to become a Person relationship. No automatic name matching or backfill is introduced.

Derived Letter labels are display-only:

- From and To: Letter from Jan Allen to Tina; a known document year adds `, 2010`.
- From only: Letter from Jan Allen.
- To only: Letter to Tina.
- A saved source transcription with no core metadata: Letter, without the old placeholder warning.
- An explicit user title always wins. The stored historical title is never rewritten to generate a label.

The same interpretation is used on the normal item, transcription reader and catalogue cards. Untouched material retains the existing uncatalogued display. A source transcription counts as In progress; human-reviewed source text, or reviewed correspondence plus a document date, is sufficient for the display state Catalogued. This is a progressive presentation state, not an automatic write to `catalogued_at`, verification state or optional metadata. The state is available in Archive information rather than a prominent completeness warning.

## Reading and concise review

The handwritten page remains primary. Read transcription is a visible button immediately below the page, before the thumbnail picker; unprocessed documents offer Transcribe letter/document. A completed source attempt is used for the read link. Transcribe again remains secondary. Existing incomplete attempts and translation/history remain reachable through the review workflow.

Desktop retains Original | Source transcription; phone layout stacks them. Human-reviewed text is explicitly labelled, corrections retain the raw AI draft and revision history, and uncertainty remains in the text. Additional reading notes are expandable. The reader uses the meaningful Letter title as well as the normal item page.

Review what AI found appears before Advanced review. Correspondence gives compact From, To, Date and Place rows, with Not identified for absent suggestions. Confirm/Change/Ignore controls reveal editable values and optional canonical selection only when needed. Dates are readable in the summary and retain structured precision for writes. People mentioned use Link person/Ignore, summaries use Accept/Edit, and topics have individual review controls. Nothing is applied merely by opening the page.

Advanced review retains the detailed suggestion checkboxes, decisions, reviewed values, evidence/page references, canonical record selection/creation, role/date precision and atomic multi-selection save. Both paths call the same permission-, source-version- and decision-checked review RPC. Previously accepted decisions remain history rather than becoming editable AI drafts. The existing reviewed-transcription search loader and plain reviewed text columns are unchanged; this pass adds no search system.

## Measured performance findings and changes

Measurements used the existing production artifact and then the final artifact, with loopback-only synthetic Auth/PostgREST/Storage and the same four-page fixture. No hosted latency or real handwriting was profiled. Values are single runs with Playwright navigation overhead, not statistically meaningful speed benchmarks.

| Check | Before | Final |
| --- | --- | --- |
| First visible page ready | 145 ms | 153 ms |
| Next / previous / next / previous | 64 / 42 / 36 / 37 ms | 68 / 40 / 32 / 32 ms |
| Conditional fallback derivative read | 200, then 200; no ETag | 200, then 304; SHA-256 ETag |
| Fallback cache policy | private, no-store | private, no-cache, must-revalidate |
| Next full reading image | Requested on navigation | Begins at low priority after the current image loads |

There is no demonstrated wall-clock speedup on localhost. The verified improvements target avoidable work at hosted latency: no Storage download for an unchanged conditional response, no new image request when returning to a retained adjacent page, bounded prefetch, and less duplicated reader data. Existing direct asset GETs already used private ETag validation and backward navigation already reused browser bytes in the small baseline; those were not newly invented fixes.

The fallback preview GET had no ETag and downloaded Storage again. It now authenticates and performs original/derivative RLS lookups before returning an ETag-backed 304. The proxy previously overrode this route with no-store; it now lets successful derivative GETs retain the route’s private policy. Errors, originals, writes and other private responses remain no-store. Direct asset GET retains its existing one-file lookup and conditional strategy. Neither path creates public/shared caches or sequential signed URLs. `Server-Timing` reports auth/database/Storage on assets, and combined access checks/Storage on fallback previews.

A shared document image window mounts at most current/previous/next. Current loads eagerly at high priority. After its load event, adjacent images load eagerly at low priority; their hidden DOM nodes retain decoded bytes across nearby navigation. Moving farther unmounts distant full reading images, leaving browser private revalidation available on revisit. No process-global, localStorage, service worker or cross-user text/blob cache is added. Original download routes are not used for normal reading. The fixture verifies no master requests until deliberate Download original.

Normal reading uses the responsive thumbnail family, at most 1,200px, with known width/height and immediate placeholders. Enlarge on the normal item deliberately switches the active page to the existing display family, at most 2,400px. Small page-picker images are lazy; distant full-size pages do not render. Both normal and transcription readers share the bounded image window and retain presentation rotation. Originals, checksum, provenance and page order are unchanged.

Page text is already loaded once per selected run, within the existing 20-page document-processing limit. Moving between pages uses mounted private props with no additional transcription query. Run details, text and suggestions now load concurrently once the run is selected. The browser receives uncertainty/language/receipt metadata rather than a second copy of full page text, extraction and raw provider response JSON. A synthetic payload assertion reduces more than 100,000 characters to fewer than 200 for the output projection; this is not a measured live-letter payload size. Complete bounded raw provider responses remain persisted in the original run. The database still reads that existing run record; the projection removes browser payload duplication, not Supabase-to-server raw JSON transfer.

Letter context is fetched in archive/item-scoped paginated batches of up to 100 item IDs, using lightweight transcription status rows rather than text bodies. React cache is request-scoped. Item audio, Place and Letter context reads run concurrently; catalogue loads without Letters add no Letter-context queries. No global authenticated workspace cache is introduced.

## Migration and release order

Only **202611010016_reviewed_correspondence.sql** is new. It replaces the existing `apply_document_suggestions` function to accept an explicit `text_only` decision for sender/recipient with a matching role, no canonical ID and no create flag. Canonical Person/Place creation/linking, reviewed dates, audit events, source-version/Editor/lifecycle checks, limits and idempotence remain. Text-only confirmation writes the existing reviewed-value/audit fields; it does not insert a Person or identification.

No table, column, index, historical row or Storage object changes on installation. The complete replacement is enclosed by BEGIN/COMMIT. Migrations 001–015 are unchanged. Verify the live baseline through 015, then have an authorized human apply only missing 016 before deploying this application. Do not rerun installed SQL. No remote SQL was executed in this pass.

Read-only function-definition marker (not a complete baseline/grant audit):

```sql
select to_regprocedure('public.apply_document_suggestions(uuid,jsonb,jsonb)') as review_rpc,
       position('invalid_correspondence_text' in pg_get_functiondef(
         to_regprocedure('public.apply_document_suggestions(uuid,jsonb,jsonb)'))) > 0
         as supports_reviewed_correspondence_text;
```

See [final validation](validation.md) and [exact commit manifest](letter-reading-commit-manifest.md). Generated `next-env.d.ts` remains outside the commit.

## Exact production smoke test after an approved release

1. Confirm only missing 016 was manually installed after the established baseline. Deploy the reviewed application through the normal approval process. Leave the existing Anthropic configuration unchanged; never print its key. No new transcription is required for this smoke test.
2. Open the existing real test Letter as an Editor without uploading again. Record its item URL/ID, original download SHA-256, page sequence and current metadata. Check the handwritten image remains primary, with a clear Read transcription button before the thumbnail picker.
3. Open Read transcription. Verify original/source text comparison, Previous/Next and page position. Confirm the existing draft and history remain; no provider request should occur from reading or changing pages.
4. Under Review what AI found, review only values supported by the Letter. For a supported Jan Allen sender, use From → Change → select the existing Jan Allen Person → Confirm. For a supported Tina recipient without a Person, use To → Confirm to keep reviewed text. Confirm the correct document date. Review/link an identified written-from Place only if supported; otherwise leave it unknown. Do not enter the examples merely to satisfy the display test.
5. Reopen the same Letter. Where supported/applied, expect Letter from Jan Allen to Tina and the known year, with readable date and visible From/To/Date/Place. From should link to the same canonical Person; Tina should not have forced a new Person. Reload and verify. An explicit existing caption must still win. The stored generic placeholder need not be rewritten.
6. Open Advanced review and confirm detailed evidence, roles, decisions and record controls remain. Accept/edit a disposable summary or topic only deliberately. Correct one transcription line if needed; verify Human-reviewed text, the separate raw AI draft, unchanged earlier attempt and source/translation separation. Reviewed text must remain discoverable through the existing search behavior.
7. In browser DevTools, preserve the Network log. Open a multi-page Letter; wait for the first image to load and confirm the next reading image starts afterward at low priority. Move next/back twice: the previous adjacent image should remain decoded without a fresh request. Distant full reading images must not all download; small lazy picker images are expected. Normal reading should use private derivative URLs, not `/api/v1/files/` masters.
8. Navigate away and return. Inspect `/api/v1/assets/` and fallback `/api/v1/previews/` responses: private no-cache/must-revalidate, ETag and conditional 304 where unchanged. Server timing on a 304 should omit Storage work. A full page return still requires authenticated server work; this change does not promise zero hosted latency. Deliberately Enlarge to check the larger display derivative.
9. On a physical iPhone, verify stacked Original then Transcription, readable title/date, clear corrections and concise summary, working page navigation, rotation and no horizontal overflow. Test normal Letter detail as well as its transcription reader.
10. Compare the original download SHA-256, item ID, source count/page order, People/Place/date/comments/recollections and provenance against the starting state, allowing only deliberate review changes. Sign out and verify conditional derivative requests cannot return 304/data anonymously; use an account without archive membership to confirm cross-archive denial. Existing Provider/model/cost confirmation, translation and retry controls should remain intact if separately exercised; a new live processing attempt incurs cost and is optional.

Remaining manual acceptance is hosted performance, physical-device behavior and the existing real Letter’s supported review values. Local synthetic fixtures cannot establish those production outcomes.
