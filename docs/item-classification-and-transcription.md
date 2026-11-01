# Item classification and document entry — release 015

The reported item was stored as Photograph, so the document-only transcription controls were correctly absent. The old single-item capture screen defaulted to Photograph; it did not infer Letter from handwriting or a HEIC/JPEG file. Its legacy Start a letter shortcut also toggled an already-selected Letter back to Photograph. Without production interaction logs we cannot identify which path was used for this particular upload. Both ambiguous capture behaviours are now removed.

## Correct an existing item without uploading again

Eligible Contributors can change their own active, ready, unarchived and unverified contributions; Editors/Admins can classify other eligible items. Change item type is available beside the source material on the normal item page and in the catalogue editor. Choose Letter, Document, Photograph, Object, Postcard, Certificate, Artwork or Other, then Save item type. Audio retains its dedicated recording workflow. Archived/deleting/context items are not offered this control.

The dedicated save changes only kind, edit attribution/time and, when leaving a separately imported Photograph, its single-object grouping semantics. The item ID, title, verification state, catalogue completion, date/Place text, notes, files/checksums/paths, responsive image sets, orientation, People/Place links, comments, recollections and historical import membership remain. No split, duplicate item, re-upload, Storage write, derivative deletion or AI request is performed. A stale expected kind is rejected, and active document processing must stop before classification changes. A before/after kind event records the decision.

Legacy generated placeholders such as Photograph, still to be catalogued are interpreted using the current kind for display. Their stored title is retained. Deliberate user titles remain unchanged. This avoids leaving a Letter visibly labelled as a Photograph after correction without rewriting historical captions.

A full catalogue form already supported kind editing, but it saved all fields together and changed catalogue/verification state. The new narrow RPC is necessary for an independent type-only save that cannot overwrite a concurrent date/notes save. The full editor now reuses the independent type control and submits its current kind in the remaining form, rather than exposing a second competing selector.

## Capture intention before files

The generic Add screen starts with no chosen material intention. Camera/upload inputs and their visible buttons remain disabled until a choice is made. The internal neutral Other fallback cannot be saved without that choice. Choosing Letter is idempotent: pressing the old shortcut again no longer switches back to Photograph.

- Add photographs opens the existing separate-photograph import workflow: each selected photograph is its own Photograph item.
- Add a letter or document chooses one object with ordered pages. The upfront Material type selector supports Letter, Document, Postcard and Certificate. One, two or four images remain one item. Optional page/front/back/envelope/picture/written-side labels, move/remove/add controls and immutable per-page masters remain.
- Add an object keeps its views together as Object.
- Record a memory retains the existing voice/audio workflow.
- One photograph, front and back is a secondary explicit single-photograph intention; the existing multi-photo grouping confirmation remains.

File signature/MIME validation still determines technical format only. It never decides the historical object type. No AI is invoked to guess a classification.

## Obvious document actions

Letter, Document, Postcard and Certificate detail pages show a Document transcription section **above the page reader**. Eligible members see Transcribe letter or Transcribe document with: Use AI to create an editable transcription. The original remains unchanged. Existing attempts expose View transcription and Transcribe again. These links open the existing review and explicit page-count/cost confirmation; navigation itself makes no paid request.

Ordinary Photograph/Object items have no handwriting action. Correcting the existing saved item to Letter immediately makes its existing originals available to the current document snapshot/processing workflow. No re-upload is required. Postcards use the same ordered picture/written-side model; no facial recognition is added for picture sides.

The Anthropic/OpenAI abstraction, configured model, attempt leases/history, raw receipts, transcription review, translation, structured drafts and human canonical approval remain unchanged. The server still selects Anthropic when `DOCUMENT_AI_PROVIDER=anthropic` with the configured model/key. Missing configuration has a visible notice and the existing review's disabled action; keys never enter this component or the browser bundle. No live provider call or secret inspection was performed.

## Migration/manual release

Only **202611010015_item_classification.sql** is new. It adds one authenticated permission/version-checked `set_item_kind` function, with no table/column change, historical backfill or Storage operation. Migrations 001–014 are unchanged. Its BEGIN/COMMIT encloses the entire installation.

A human should verify the real installed baseline through 014, then manually apply only missing 015 before deploying the application. Do not rerun installed SQL. No production SQL, push or deployment was performed by the agent. Read-only installation marker:

```sql
select to_regprocedure('public.set_item_kind(uuid,uuid,text,text)') as classification_rpc;
```

Presence alone is not a complete grants/definition audit. No new environment variables or dependencies are required.

## Exact live test procedure

After an approved manual schema/app release:

1. Open the existing misclassified letter as an Editor or its eligible Contributor. Record its URL/item ID, current type, original download SHA-256, source count and existing People/Place/date/comments/recollections. Do not upload it again.
2. Open Change item type, select Letter and Save item type. Verify the same URL/item, Letter classification and a visible Transcribe letter action above its pages. Check the generated display label follows Letter while any deliberate caption remains.
3. Reload; verify original checksum, ordered files, derivative receipts and all existing metadata/conversation/recollections remain. Open a second browser tab with the old kind to verify a stale type save is rejected.
4. Click Transcribe letter. Verify the existing review opens and asks for explicit page-count/cost confirmation. With the already configured Anthropic environment, explicitly confirm once. Inspect source-language drafts, uncertainty, returned model/provider receipts and history. Never print the API key while diagnosing. No request should occur merely from changing the type or opening the item.
5. Correct a draft, inspect the preserved raw AI output, deliberately approve selected canonical suggestions and optionally request separate English translation. These are the unchanged existing flows and can incur API costs.
6. In Add, verify upload/camera is disabled until an intention is selected. Select Add a letter or document before files. Save disposable synthetic one-, two- and four-page letters; each must be one Letter with ordered independent originals and an immediate transcription entry point. Press Start a letter twice and verify Letter stays selected.
7. Repeat with Document and a two-sided Postcard; verify document actions. Add an Object and verify grouped views without handwriting controls. Use Add photographs with two images and verify two separate Photograph items.
8. Check Viewer/other Contributor/signed-out/cross-archive denial and archived/active-processing guards. On a physical phone check the type chooser, material choices, page labels/order, clear actions and overflow. Test a no-key local/preview configuration separately; the preserved reader must remain usable with honest unavailable AI feedback. Do not remove the real Production key for this check.

See [validation](validation.md) and [exact commit manifest](item-classification-commit-manifest.md). Live model/account access, handwriting quality, billing, hosted latency and physical-phone acceptance remain manual checks.
