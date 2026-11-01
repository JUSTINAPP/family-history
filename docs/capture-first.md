# Capture first, classify second

Base `4a7eea5`. This is an application UX/state correction. No new migration, environment variable, dependency or provider adapter change. Migrations 001–015 remain unchanged. No production access, live AI call, commit, push or deployment was performed.

## Disabled controls: cause and correction

Release 015 introduced `intentChosen=false` and `disabled={!intentChosen}` on both native camera/library inputs and both visible buttons. Its add handler also rejected selection before a material intention. This directly explains the reported grey controls for a permitted member: the screen required a type choice first. Role checks still matter for non-Contributors, but the eligible-member failure came from this state gate, rather than browser capability detection, camera permission or loading. We did not inspect production logs or credentials.

The intention gate is removed. Eligible members can immediately open either native chooser. Buttons and inputs are disabled only while saving or after a multi-photograph import has begun, when changing the selection could detach an in-progress batch. Server-side permissions remain authoritative. Viewer/demo access feedback and its demo preview link remain available.

## Everyday flow and grouping

The initial screen shows What have you found?, Take photo and Choose from library, with Record a memory as a secondary link to the retained standalone audio workflow. There is no upfront type chooser, Rapid capture switch, Start a letter or Bulk upload entry link. Files stay local until Save.

After selection, the actual image and thumbnails appear before What is this? The choices are Photograph, Letter / document, Object, Postcard and Not sure. Letter / document also allows Document or Certificate. Technical format validation never infers a historical classification.

- One Photograph creates one item. Multiple Photographs default to one independent item per image through the existing import pipeline. The count and Save N photographs action appear inline. Shared words stay on the batch. A secondary front/back choice explicitly keeps one photograph’s sides together.
- Letter, Document, Certificate and Postcard keep ordered originals in one item. Multiple pages default to Keep together as one letter/document/postcard. Reorder, remove, add another page and optional page/front/back/envelope/picture/written-side labels remain. Unchecking the grouping asks the user to save one document at a time; it does not silently split or guess document boundaries.
- Object keeps multiple views in one item with optional view labels.
- Not sure saves as Other. Multiple images stay together without destructive inference. The existing Change item type control can classify the saved item later, using release 015’s permission/version guards without re-uploading or changing masters or metadata.

Existing limits remain: up to 500 selected photographs per batch and 30 MB per source; a grouped single-item save accepts at most 20 images and 80 MB in total. A larger unknown/document group receives an honest limit message and stays selected. Imports retain stable capture IDs, progress, retry and the existing resumable batch URL/inbox. Once import starts, the parent selection/type controls lock to protect those IDs. The legacy import/resume routes remain supported.

Save & capture another preserves the item, clears the current selection and returns to the two main actions with a saved confirmation and Capture another. The camera opens from that explicit gesture; an asynchronous save does not try to force a phone camera dialog. Ordinary Save to archive opens the preserved item.

Optional written context and reported details are expandable. Initial capture contains no AI/transcription decisions, generated metadata suggestions or embedded voice-transcription workflow. Record a memory retains the real audio recorder/upload flow. New demo captures simulate preservation/preview preparation only, without claiming that a Letter has been transcribed.

## Saved letters remain visual

The live Letter/Document/Postcard reader leads with a large source image, ordered page navigation and thumbnails. It appears before restrained Transcribe letter/document actions, then Who, When, Where, family conversation and recollections. Existing attempts expose Read transcription and Transcribe again. Original file details remain expandable. Other material retains its existing layout and conversation placement.

Transcription remains optional and happens only after saving and explicit confirmation in the existing review workflow. Supporting copy explains that original pages remain unchanged. The existing original/draft comparison, human corrections, attempt history, raw provider receipts, translation and deliberate canonical approval remain. Opening an item, changing its classification, selecting files or saving does not request document AI. Automatic responsive-preview preparation remains separate from paid document AI.

The Anthropic/OpenAI abstraction, configured model, cost/page limits and claims/retry behavior are unchanged. Missing AI configuration still leaves the source reader usable and shows the existing unavailable feedback. No secret was read or printed; automated provider tests use mocked responses.

## Mobile and validation

Camera uses the native environment-facing capture hint; the library input supports multiple selection. Phone layout puts material before classification, with wrapping save actions and thumbnails that leave room for 44px reorder/remove controls. Browser checks cover immediate native chooser opening, camera versus multiple-library selection, grouped documents, object views, unknown preservation, twenty separate items, source ordering/export, responsive bounds and accessibility. Local 375px screenshots were visually reviewed; the thumbnail touch-target issue found during review was corrected.

See [final validation results](validation.md) and [exact proposed commit contents](capture-first-commit-manifest.md). Real iPhone camera/library behavior, hosted upload latency and live Anthropic output/billing remain manual acceptance checks; local HTTP fixtures and mocked provider responses cannot establish those results.

## Exact production smoke test after an approved deployment

No new SQL is required for this change. Confirm the application’s existing baseline through 015; do not rerun installed migrations. Use disposable, non-sensitive test material in a private archive. Do not experiment on irreplaceable family items.

1. As a Contributor or Editor on a physical iPhone, open Add to archive. Verify both primary actions are enabled immediately, with no type requirement, Rapid capture switch or Start a letter/Bulk upload link. Tap Take photo and confirm the rear camera opens. Cancel, then tap Choose from library and confirm multiple selection is available.
2. Take/select one test photograph. Verify the image appears before What is this?, choose Photograph and Save & capture another. Confirm one item was saved. Tap Capture another and verify the camera opens from that tap. Save a second item normally and reopen both from Explore.
3. Select twenty distinct disposable images from the library, then choose Photograph. Confirm 20 photographs selected and Save 20 photographs. Save once; expect twenty independent item IDs, one original per item and an import completion summary. Reload the batch URL/inbox to verify durable progress. Do not deliberately interrupt a real family batch for this smoke test.
4. Save synthetic one-, two- and four-page letters in turn: select files first, choose Letter / document, keep together, reorder pages, label front/back/envelope, remove and re-add one page, then Save to archive. Expect one Letter per selection with the chosen order and all original downloads. Repeat with a two-sided Postcard or Document subtype.
5. Verify each saved letter opens on the original page reader before transcription actions. Navigate its pages, enlarge one and inspect rotation. Verify Who/When/Where, family conversation and memories remain below. No AI run or provider charge should have occurred from selection, save or opening the item.
6. Save two object views as Object; expect one item. Save a one-image Not sure and a two-image Not sure; expect Other, with the latter grouped. Change one saved Other/Photograph to Letter and then Document. Verify the same item ID, source SHA-256 downloads, source count, order, People/Place/date/comments/recollections and derivative receipts remain. Document actions should appear only for appropriate document kinds.
7. With live Anthropic already configured, deliberately click Transcribe letter on one disposable two-page letter and confirm the existing page-count/cost prompt once. This step consumes the live API. Verify ordered source-language drafts, uncertainty markers, provider/model receipt and history. Correct one line and verify raw AI text remains separately available. Reload the normal item: source images remain primary, with Read transcription. Optional translation and canonical suggestions still require separate deliberate actions; confirm nothing canonical was applied automatically.
8. Add a comment/reply and verify People, Places and date editing on a test item. Check an existing import and HEIC source, responsive previews and rotation, comparing the original download SHA-256 before/after. Preview-generation failures must not hide or alter originals.
9. Verify an eligible Contributor can add/classify their own material, a Viewer cannot upload, another Contributor cannot edit someone else’s protected item, and signed-out /add redirects to sign-in. Repeat at narrow phone width with no horizontal overflow or thumbnail buttons outside their cards. Keep existing archive permissions/private Storage unchanged.

No automated check used the live Anthropic API. Test accounts, source fixtures and screenshots used for validation are local only.
