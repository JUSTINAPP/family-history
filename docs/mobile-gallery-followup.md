# Mobile gallery and Places follow-up

Base: `62fdcfc`.

Mobile Home/Explore/Add/People navigation is fixed to the bottom of the viewport, with safe-area padding and reserved page space. It hides while text fields are focused so it does not compete with the software keyboard. Desktop navigation remains in the header.

Authenticated Home now has a horizontally scrollable, scroll-snapping gallery. The visit-stable featured selection leads, followed by other eligible unarchived image items from the authorised catalogue. Native scrolling, keyboard focus and previous/next buttons are available. Twelve cards render initially; Show more images appends another twelve. There is no autoplay. Audio and items awaiting previews remain accessible through Explore. Images retain private small derivatives and lazy loading.

Gallery frames now calculate their width from the presented image ratio and the height limit. Square photographs therefore retain square frames; portrait and landscape sources keep their proportions. The full source stays contained, with existing rotations and straight captions.

Places already shared the People pile renderer. When a Place has no ready image sets, it now tries up to four linked original preview endpoints using their existing display derivative. These requests remain authenticated and do not trigger conversion or fetch originals. Missing derivatives show Preview unavailable. This fallback does not establish why any particular production image-set metadata was absent; production acceptance must confirm the affected Places. Ready People and Places piles continue using small derivatives.

No migration or new dependency is required. Generated `next-env.d.ts` is excluded.

Validation: lint, TypeScript, production build, whitespace checks, 122 general regressions and 20 authenticated browser checks passed. The browser suite covers eight widths from 320 to 1440px, bottom-bar positioning, gallery navigation, frame proportions, private image delivery and Retina selection. Final browser run: `TEST_PREVIEW_SKIP_BUILD=1 TEST_HEIC_FILE=/private/tmp/archive-example.heic npm run test:previews`, reusing the verified build. Logs are `/private/tmp/archive-followup-large-fixture.log` and `/private/tmp/archive-followup-regressions.log`. Initial runs caught obsolete three-card expectations and use of the tiny codec fixture for a Retina check; the updated expectations and established full-size fixture passed. The 375px Home screenshot was visually reviewed. Physical Safari acceptance remains pending.

After deployment, verify the affected Places on the live archive, bottom navigation with Safari chrome and the keyboard, swipe/Back behaviour, and square/portrait/landscape frames. A browser session may retain its selection across browser restart if session restoration is enabled.
