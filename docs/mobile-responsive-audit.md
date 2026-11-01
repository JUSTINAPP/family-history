# Mobile responsive audit — 2 November 2026

Base `82ddc7c`. This pass preserves the editorial archive direction and corrects phone layout, text and controls across the site. No production access, real family-file access, live AI call, commit, push or deployment was performed. No migration, dependency or environment change is required. Migrations 001–016 remain unchanged.

## Findings and measured overflow

The ordinary synthetic live fixtures initially fit all five phone widths across sixteen routes. We did not inspect production or receive the actual screenshot image, so this does not establish one exclusive cause for the reported live screenshot. Stress tests reproduced three concrete failures in the existing implementation:

- Whole scrapbook articles were rotated, including arbitrarily tall image frames and captions. Rotation enlarges visual bounds without reserving layout space. A tall-paper aspect-ratio stress case widened the document beyond every tested phone viewport.
- At 320px, the profile panel extended 24px off the left edge. Positive `scrollWidth` alone misses this clipping, so tests now check popover rectangles as well.
- A long archive name was squeezed between fixed controls and hidden by a two-line clamp. At 320px its visible height was 31px while its text needed 63px.

| Phone viewport | Tall-paper document width before | After |
| --- | ---: | ---: |
| 320px | 341px | 320px |
| 360px | 393px | 360px |
| 375px | 412px | 375px |
| 390px | 431px | 390px |
| 430px | 483px | 430px |

The stress ratio was deliberately extreme (0.06), not an assertion about a real family original. Ordinary portrait/landscape content and the existing presentation-rotation fixtures are also retained. The corrected 320px name uses 42px with 42px of text, and the profile panel is inside the viewport. Ordinary fixture document widths remain equal to the viewport before and after.

The full regression suite additionally exposed a story-detail related-material grid forced to three columns by an inline style. With readable phone text it produced a 370px document at 320px. Its inline rule is replaced with a responsive class: one phone column, three shrinkable desktop tracks. Other recent-material tracks and caption flex children can now shrink. This fixes the grid rather than making the text small again.

## Containers, header and scrapbook

Phone styles share the existing gutter token, now 16–22px below 600px. The existing border-box sizing is retained. Specific page/grid/flex children receive `min-width: 0`; form controls and media respect their containers. Long headings, filenames, metadata, names and footer text can wrap. There is no body/html horizontal-overflow hiding rule.

The phone header uses a full-width archive-name row and a separate row for Search, Add, Profile and Menu. The full name can wrap without a line clamp. All four controls have 44×44px areas. Profile and archive panels stay within the header width; the menu uses the actual header bottom rather than a fixed top offset. Profile and menu do not stay open over one another. Escape closes them and restores focus. The menu has expanded/controls semantics, remains unmounted when closed and explicitly disables route prefetch on its links. Desktop navigation and the 111px desktop header remain.

The phone scrapbook keeps alternating offsets, paper shadows and restrained rotations. Rotation is applied only to the media frame, not long captions. Media height is bounded to the smaller of 65svh and 560px. The composition has padding for decorative edges and localized `overflow: clip`; it does not rely on clipping the whole document. Source pixels still use contain/LQIP behavior, with captions outside the rotated paper. Desktop retains three scrapbook columns and its existing whole-paper rotations.

## Phone typography and touch rhythm

The shared phone tokens are:

| Use | Size |
| --- | --- |
| Body, comments, transcription, form input | 1rem, normally 16px |
| Interface, labels, helpers, timestamps, metadata | .875rem, normally 14px |
| Eyebrows, small material labels and ordinal captions | .75rem, normally 12px |
| Important touch areas | 44px minimum; primary fields 48px |

Story prose retains a larger 1.25rem serif reading size. Editorial headings use responsive rem/vw clamps; desktop type is unchanged. A visible leaf-text audit across sixteen live routes at 375px found no remaining samples below 12px after correcting People lifespan/category labels, breadcrumbs, back links, file links and admin metadata. This is a practical inspection, not a guarantee about every possible user-generated view.

Buttons, page navigation, comment counts/replies, image options, picker actions, summaries, footer links and important admin links get structural touch room. Checkbox/radio visuals remain 22px inside readable label areas of at least 44px. Fields use full-width controls with labels above them and 16px text, which avoids the small-input focus-zoom problem without disabling pinch zoom. Existing focus styling is retained/extended. No user-scalable/maximum-scale restriction or text-size-adjust suppression is added.

## Route-specific behavior

- **Explore:** one stable column on phones, two-column wrapping filter controls, readable captions/counts and a full-width inline conversation. Card expansion does not rebalance CSS masonry columns. Its responsive `sizes` now matches the actual full-width phone card.
- **Item detail:** source first, then Who/When/Where, Family Conversation, memories and expandable archive information. Normal non-document items now share this metadata-before-conversation order. The same desktop columns remain; the content priority is intentionally consistent across widths.
- **Conversation:** 16px body, 14px byline/time, modest reply indentation, full-width composer, readable controls and retained focus after posting. Tests reduce the viewport height to 440px while typing to exercise keyboard-space assumptions; this is not a real iOS keyboard test.
- **Quick Catalogue:** photo, Who/When/Where, comment and Next remain. The sticky navigation has a compact three-track first row with the secondary action on its own row. The photo strip and fields fit rather than shrinking desktop controls.
- **People and Places:** existing archive-local material piles remain within their frames; names and metadata wrap at readable sizes. Phone layouts retain the established single-column People/Place material cards.
- **Letters:** original page, prominent Read transcription and correspondence information remain. The transcription reader stacks Original before Transcription on phones. Bounded adjacent prefetch/private revalidation and source rotation are unchanged. Page buttons and advanced review fields receive the common type/touch sizing.
- **Capture and forms:** material-first capture is unchanged. Selected pages, role selectors, optional context, save actions, voice upload and catalogue/AI forms fit the phone. Advanced review remains collapsed by default. Admin/settings/member/invitation/processing views share the responsive field/container rules.
- **Stories:** the related-material grid now responds to phone width rather than forcing three tracks through an inline declaration. Its disclaimer no longer forces 11px text.

## Images and performance

No new server query, API, dependency, provider call or duplicate desktop/mobile content tree is introduced. Closed mobile navigation has no mounted links. Existing image laziness, placeholders, private delivery, authorization, ETags, attempt history, transcription search and immutable source downloads are retained. Existing performance assertions and the 1,007-row discoverability check pass.

The private image component now honors a caller's `sizes` on its fallback Next Image path too. Live Explore declares 90vw for its single-column phone cards rather than the old two-column 44vw assumption. The Retina check verifies a 390px/DPR3 gallery selects the existing 1,200px thumbnail, rather than underfetching the 600px small copy; it does not download the master or force a 2,400px display image. Other responsive variants and native lazy loading remain.

There is a deliberate quality trade-off: high-DPR full-width cards may fetch a larger thumbnail than before. At DPR1 the existing 600px small candidate is still appropriate. We do not claim that all initial byte counts decrease. The CSS source grows by 9,791 bytes, about 1,952 additional gzip bytes when comparing source files; this is not an on-wire compiled-bundle benchmark. No paid AI was used, and no hosted performance claim is made from local fixtures.

## Validation scope and limits

The authenticated production matrix covers **nineteen routes at 320, 360, 375, 390 and 430px**:

Home, Explore, Quick Catalogue, People, Person detail, Places, Place detail, Photograph detail, Object detail, Letter detail, transcription review, Add, Record a memory, Admin, Settings, Members, Invitations, Processing and catalogue editor.

Each route checks document width against client width. Expanded checks cover full archive names, profile/archive/menu panels, Escape/focus, tall paper, inline comment post/reply, reduced-height composer focus, rotation controls, Quick Catalogue navigation, expanded Advanced review, selected multi-page capture and 150% root text sizing. Assertions cover 44px header/important controls, 16px inputs/comments, 14px People metadata/back links, axe accessibility on active review/capture and DPR3 private derivative selection. A 1440px check retains three scrapbook/four Explore columns, desktop paper rotation and the desktop header.

The demo route sweep also covers 320/360/375/390/430/768/1024/1440px, including the sample story, tree and source-review views. Chromium responsive checks and screenshots are not physical iPhone Safari acceptance. Pinch zoom, iOS dynamic type, safe-area/browser chrome, native choosers and software-keyboard behavior still need the manual checks below. No screenshots or fixtures contain production family material.

See [final results](validation.md) and [exact proposed commit contents](mobile-responsive-commit-manifest.md). No migration is needed; do not rerun migrations 001–016 for this release. Existing generated `next-env.d.ts` stays outside the commit.

On restart, the original successful build/test logs were recovered and the implementation was preserved. Recovery added the missing commit manifest and reran lint, TypeScript and whitespace checks successfully. A fresh production-build/browser attempt was blocked before browser execution by the current environment's Turbopack worker-port restriction; see the recovery details in [validation](validation.md). The passing browser counts above refer to the completed pre-interruption runs.

## Exact production iPhone smoke test after an approved application deployment

1. Deploy only the reviewed application changes through the normal approval process. Run no SQL. On a physical iPhone, open the private archive at default page zoom in portrait, then landscape. Confirm the whole archive name is visible and the document cannot be swiped sideways. If using Safari Web Inspector, compare `document.documentElement.scrollWidth` and `clientWidth` at default zoom.
2. Open/close the archive switcher, Profile and hamburger menu at the narrowest available phone size. Verify panels remain onscreen, targets are easy to hit, navigation works and keyboard focus is sensible. With an external keyboard, test Escape and Tab. Opening Menu should not start loading all destination pages.
3. Browse Home with the real mix of portrait photographs, letters, long captions and rotated sources. Paper should retain offsets/rotation while captions stay readable; no paper should widen the document. Check the recently added list and footer too.
4. Open Explore. Use People/Date/Place/Collection filters, long values and search. Open an inline conversation, type with the iPhone keyboard, post, reply and edit. Confirm the composer fits, the text is readable, position/focus remain useful and closing/reopening does not shift the page sideways.
5. Use Quick Catalogue: inspect a photo, add/review Who/When/Where and a comment, then Next/Previous. Confirm independent saves still work, controls are finger-friendly and sticky navigation does not obscure the photo or focused field.
6. Open People, a Person, Places and a Place. Check rotated material stacks, long names and metadata. Open a linked photograph/Object: image first, then Who/When/Where, conversation and memories. Test Image options/rotation on disposable material and verify the original download remains unchanged.
7. Open the existing real Letter without re-upload. Check original pages, Read transcription, From/To/Date/Place and page navigation. Read/correct text in the stacked reader if needed; inspect the concise summary and expanded Advanced review. Existing AI history, reviewed text, translation and permissions should remain. Do not start a paid transcription just to test layout.
8. Open Add. Test Take photo and library selection, one unknown item, multiple photographs and grouped Letter pages. Review page labels, optional notes and save actions. Check Record a memory, admin settings/member/invitation forms and any story views used by the archive.
9. Increase Safari text size to 125–150%, then test pinch zoom. Text may reflow vertically; zoom must remain available. Recheck header, filters, comments, capture and review forms with the keyboard visible. Horizontal panning while deliberately pinch-zoomed is normal; the bug check is document overflow at default zoom.
10. On a Retina phone, inspect representative private image requests if available: gallery thumbnails should match displayed width/DPR, with placeholders/lazy images below the fold and no master download for normal browsing. Compare hosted behavior rather than assuming localhost timings. Finally check desktop at 1440px and sign out to confirm private routes/assets still require authentication.

No production smoke test was executed by the agent. Physical Safari acceptance remains the final release check.
