# Image feed and private face review

Home now presents the existing visit-stable collection as natural-height masonry tiles, in a three-photo / one-letter pattern while both types are available. It mounts 24 at a time, loads private previews near the viewport, and shows muted colour placeholders. The full photo retains its proportions when opened. People and Places photo piles are unchanged.

Opening a tile keeps browsing on Home. The viewer includes comments, voice recording/listening, previous/next, related material, and a link to the full editing page. Related material prioritises shared People links, then the same or nearby year and shared Places. Unlinked fallback material is labelled honestly. Browser Back closes the viewer; returning from the editing page restores the viewer and feed position.

## Find people

Choose **Find people** on Home, select an existing person, and tick known reference portraits. Only photographs linked to exactly one person are offered as references; the model must detect exactly one face in a chosen reference. It checks up to 24 candidate photographs per batch. Users can pause between photos and continue later while the dialog stays open.

Possible matches are suggestions, never automatic identity assignments. **Yes, link [name]** uses the existing authenticated People action and its database permissions. Dismissed suggestions and face descriptors are held only in browser memory and discarded when the dialog closes. Confirmed People links are stored normally. No schema migration is required.

The Human 3.3.6 browser library and BlazeFace, FaceMesh and MobileFace models are served from `public/face-models`; no external face service or CDN is called. Downloads total approximately 6 MB and begin only when matching is requested. MobileFace provides embeddings without the default age/gender model. Source URLs, pinned revisions and SHA-256 checksums are in `sources.json`, alongside upstream licences.

This first version runs comparisons on the visitor's device, not a permanent server-side index. Clear, single-face reference portraits are required. Group-photo reference selection, matching across large age differences, obscured/side-on faces and historical image quality need real-world evaluation. A similarity threshold is not a probability of correct identity. Browser tests exercise real model loading and no-face inference; controlled descriptors separately verify that suggestions cannot write a People link before confirmation. Positive-match accuracy on the family collection and physical iPhone performance remain acceptance checks.

## Acceptance checks

- Home: first screen contains staggered, rounded images with coloured loading states; three photos per letter when possible.
- Open, follow a related photo, close: return to the same position. Open full details and use Back: return to the viewer.
- Comments, voice capture, listening and cinematic pause/close still work.
- Find people: select a clear known portrait; check a batch; dismiss a false match and confirm a true match. Verify the People page after confirmation.
- Repeat on iPhone Safari, including slow connection, reduced motion, text enlargement and a long collection.

Validation results are recorded in the change report after checks complete. Synthetic test images are not examples of face-recognition accuracy.

## Validation — 15 November 2026

Production build, lint, TypeScript and whitespace checks passed. Eight selection/related-material regressions passed. All 29 authenticated browser checks passed across the core run and focused reruns, including the eight-width audit (320, 360, 375, 390, 430, 768, 1024, 1440), accessibility checks, preserved voice/comment flows, browser Back, preview recovery, and the explicit face-confirmation boundary. Retina delivery was verified with a synthetic 1800×1200 HEIC rather than the small default fixture. Model/library checksums matched the pinned sources. Upstream assets retain their exact bytes; vendor whitespace is excluded via `.gitattributes`. No external recognition requests were made by the real-model browser check.

Physical iPhone Safari acceptance and positive-match quality on real family photographs remain pending. No database migration was introduced. Generated `next-env.d.ts` is excluded from this change.

## Simplified browsing — 15 November 2026

Home preserves image proportions in a measured masonry grid with rounded image corners and stable reading order. Captions show recorded names, date/year or useful descriptions; generic type labels are omitted. The archive name links Home, search leads browsing, and the desktop directories are available from the Archive menu. Mobile bottom navigation remains available. Focused production browser checks cover image visibility, varied heights without overlap, mobile bounds, menu loading feedback and Back navigation.

## Inline voice memories — 15 November 2026

Photos with recordings show a single headphones button that changes to loading, pause or play. It controls voice playback and a gentle 16-second pan/zoom inside the tile. Tapping the image opens the normal photo-details viewer immediately and stops inline audio; there is no intermediate fullscreen player. Motion pauses with audio and respects reduced-motion settings. Production browser checks cover icon state, actual changing transforms, pause/resume, direct details navigation, return and mobile bounds. Physical iPhone acceptance remains pending.

## Mobile loading feedback — 15 November 2026

Home now shows coloured two-column placeholders when preview references are unavailable, with three bounded refresh attempts and a manual retry after a prolonged wait. Loading copy uses only names linked to the pending material. The gallery reports initial image loading and clears that status once the first four images are ready. Mobile type filters scroll horizontally to keep the two-column feed near the top. Production build, lint, TypeScript and delayed-image browser checks passed, including widths 320/375/390/430. Persistent backend preview failures still require investigation; the status does not claim that failed previews are ready.

## Expanded mobile discovery — 15 November 2026

Home is the collection and no longer shows an Explore-the-collection gateway. Opening a tile shows a rounded enlarged photo, compact actions and a scrollable two-column More-to-explore grid. The enlarged photo does not open another cinema layer; Listen remains an explicit action. Related cards retain source proportions and selecting one resets the viewer scroll to the top. Browser Back returns to the collection. Production build and focused browser checks passed for direct collection entry, related browsing, Back and inline voice playback.

## Bulk orientation review — 15 November 2026

Admins can open Correct photo orientation from the archive menu to check existing photographs. The batch accepts only changed rotations with confidence at least 0.9 and no review flag, preserves existing crop points and original files, and checks for concurrent framing edits before saving. Uncertain results remain for individual review. No migration is required. Production build and two focused browser checks passed, including preservation of crop points and exclusion of uncertain suggestions. The fixture admin endpoint is local test infrastructure only.

## Unified browsing — 15 November 2026

- Main menu: Collection, People, Places, Stories and Invite someone. Maintenance tools remain in the account menu; photo corrections remain admin-only under Manage archive. Mobile Explore is labelled Search.
- Search retains its detailed filters and archived-item management while active results use the Home masonry feed and expanded viewer. Recording, comments, quick metadata and transcription links remain available in the viewer.
- People and Places use compact headings, name search, rounded image piles, image-backed entries first and compact initials for empty entries. Directories have two columns on mobile and four on wide desktops.
- Existing permissions and original media are unchanged. No database migration.
- Validation: production build, lint, TypeScript and whitespace checks passed. Focused production browser checks passed for retrospective HEIC conversion, private assets/sign-out, lazy loading, archival/deletion fixture flows and unified browsing. Directory checks cover 375px and 1440px; screenshots use synthetic fixtures. Older browser tests that assert the retired Explore card markup require updating before running the entire historical suite.
