# Allen & Cork visual refresh — 2 November 2026

Base: `501bf4c` (released mobile audit). The only pre-existing working-tree change was generated `next-env.d.ts`; it remains excluded. No commit, push, migration, production access or deployment was performed.

## Implementation

The shared type tokens now use the already self-hosted DM Sans for headings, body and controls. Warm cream surfaces, dark green-grey text and muted green actions retain readable contrast. No new font download service, package or dependency is introduced. Mobile wrapping, readable form text, keyboard focus, touch areas and responsive image handling from the mobile audit remain.

The archive switcher doubles as the compact identity. The canonical `The Allen & Cork Archive` name displays as `Allen & Cork` over `Archive`; its full name remains in the accessible switcher label and archive settings. Other archive names remain complete and can wrap. At 820px and below, labelled Home, Explore, Add and People links form a generous second navigation row. Search is available through Explore. Account and Menu remain in the identity row. Menu retains Places, Stories, Quick Catalogue, bulk upload, administration and the family tree. Administration is removed from the browsing footer; editors' Archived items and Deletion progress links move from Explore's introduction into Account. Existing server-side permissions remain authoritative.

The authenticated homepage selects up to three actual, unarchived items with ready image sets from the existing authorised workspace query. Selection favours varied material kinds and linked context. It introduces no fabricated metadata or fallback sample imagery. Recently added remains a separate chronological list of up to four items. Empty archives, one/two eligible items, preview-pending items and a failed catalogue load have explicit states; existing audio remains reachable through recent items and Explore.

Phone Home shows one large item and two smaller items beneath it. Desktop uses unequal widths, restrained staggered offsets and one of three arrangements. Only media frames rotate; captions and comments remain straight. Contained source pixels preserve the whole photograph/document, including existing presentation rotations. Paper edges and light shadows replace ornamental collage elements. There is no tape or handwriting font. Decorative transforms are bounded locally rather than hiding document overflow.

Explore has a short introduction and a plain, labelled search field. People and Places introductions use neutral language. The People material-pile component, its geometry, linking and source selection are unchanged. Sign-in, item introductions, metadata and footer copy no longer introduce the application as family-only or use sentimental slogans. Historical titles, relationships, evidence wording and the Family Conversation workflow retain their meaning.

The existing explicitly labelled demo remains behind `ARCHIVE_DEMO_MODE=true`, with a matching image-led layout using its existing demo data. Authenticated live Home never imports that demo catalogue. Neither visual reference's sample images or illustrative document placeholders were added to the application.

## Visit stability and privacy

Here a visit means a browser session. A random, HttpOnly, SameSite=Lax session cookie (`archive_home_visit`, Secure in production) is created on entry pages. It contains only a random UUID: no item IDs, names, metadata or authentication information. Initialising on the entry page also covers sign-in actions that directly render Home. API requests do not create this preference cookie.

The server combines the seed with the authorised archive ID to choose material and an arrangement. Reload, internal browsing and back navigation reuse the same seed; nothing shuffles on a timer, hydration or viewport resize. A new browser session gets a new seed. Browser session-restore features can retain session cookies; a new seed can also happen if the visitor clears cookies. Random selection can legitimately repeat, especially for sparse archives. As before, actual archive edits or changed permissions can change the available material; no stale private catalogue is persisted in browser storage.

The cookie never participates in authentication, authorisation or asset caching. Supabase authentication/redirect handling and private image-route cache headers retain their existing behavior. Home still uses small private derivatives, LQIP and native lazy loading; source originals are not fetched for browsing. The lead and second item retain eager loading and the third is lazy. Explore retains its responsive thumbnail candidates, including the mobile Retina size correction from `501bf4c`. No new database query, paid AI call, duplicate media tree or image-processing request is introduced.

## Validation and screenshots

See the dated results at the top of [validation.md](validation.md). The authenticated route matrix covers Home, Explore, Quick Catalogue, People, Person detail, Places, Place detail, Photograph, Object, Letter, transcription review, Add, Record a memory, Admin, Settings, Members, Invitations, Processing and catalogue edit at **320, 360, 375, 390, 430, 768, 1024 and 1440px**.

Each width checks document bounds, long archive-name visibility, account/archive panels, tall rotated media, straight captions and 150% root text sizing on Home and Explore. Mobile/tablet navigation checks labelled destinations and touch areas. The five phone widths retain the existing conversation, reduced-height keyboard-space, Quick Catalogue, image rotation, Advanced review, capture, input typography and touch checks. Existing axe checks, desktop composition, Retina derivative selection, original checksums, private revalidation and source/permission tests remain.

Screenshots use only synthetic local records and the retained public codec fixture; the repeated test photograph does not represent real Letter/Object contents. They are QA artifacts outside the proposed commit, at `/private/tmp/allen-cork-visual-refresh/`:

- `home-{320,360,375,390,430,768,1024,1440}.png`: full-page Home at each requested width.
- `home-first-screen-{375,1440}.png`: first-screen composition.
- `explore-{375,1440}.png` and `people-{375,1440}.png`: loaded browsing and preserved material piles.

These are Chromium checks, not physical iPhone Safari acceptance. Native keyboard/chooser behavior, Safari text-size controls, browser chrome/safe areas and actual device image appearance remain manual acceptance. No hosted performance timing is claimed from local fixtures. Small Home derivatives retain the existing bandwidth limit; high-DPR Home is not promised master-resolution detail. Physical Safari and hosted latency/private-cache behavior must be checked after an approved deployment.

## Production smoke test after approval

Deploy only the reviewed application changes through the normal approval process. Run no SQL.

1. On a physical iPhone, sign in and confirm a large real item plus two smaller real items appear near the top of Home when enough previews exist. Captions must stay straight and full source pixels visible. Check an archive with one/two items and an empty archive if available.
2. Open an item, return with Back, visit Explore/People, return Home and reload. The feature and arrangement must stay stable during the browser session. A new session may show a different selection. There must be no automatic reshuffle.
3. Check labelled Home/Explore/Add/People links, the centred plus, long archive names, switching, Account, Menu and Escape/keyboard focus. Confirm Places, Stories, Quick Catalogue, bulk upload, the tree and authorised administration remain accessible.
4. Check Explore search/filtering, existing People photo piles and detail links. Test Quick Catalogue, image rotation, Family Conversation, letter reading/transcription review and capture with the iPhone keyboard open. Do not start paid transcription for a visual check.
5. Increase Safari text size and check portrait/landscape, default-zoom horizontal scrolling, menus and forms. Keep pinch zoom available. Recheck desktop at 1440px.
6. Confirm ordinary browsing requests private derivatives rather than masters, below-fold images remain lazy, conditional private revalidation still works and sign-out denies private routes/assets.

No database migration, dependency or environment configuration change is required. [Exact commit manifest](visual-refresh-commit-manifest.md).
