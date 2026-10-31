# Supabase foundation — 31 October 2026 (current)

This section supersedes the earlier prototype-only reports retained below.

- `npm run lint`, `npm run typecheck` and `npm run build`: passed. Production compilation includes authenticated routes, ingestion/file APIs and the session proxy.
- `npm run test:db`: **32 checks passed**, executing all four migrations in disposable PGlite PostgreSQL with Auth/Storage schema stubs. Coverage includes archive isolation, database grants and roles, owner protection, same-archive foreign keys, verification restrictions, immutable original policies, idempotent finalisation and reopening the database after an upload.
- `npm run test:auth`: **4 checks passed** against real-mode localhost:4000: private page redirects, anonymous API rejection, cross-origin upload rejection, safe redirects, image signature checks and mobile sign-in accessibility.
- `TEST_BASE_URL=http://localhost:4100 npm run test:e2e`: **45 checks passed** (39 retained archive/capture/admin regressions plus 6 upload-core/transport checks), including responsive layouts and axe accessibility.
- Upload unit tests exercise unchanged bytes/checksums, opaque paths, reservation/finalisation retries, permission denial and changed-source conflicts. Multipart tests preserve bytes and reject oversized chunked requests even without Content-Length. Transport is bounded to 90 MiB; actual source limits remain 30 MiB per file / 80 MiB per capture.
- Supabase Auth returned HTTP 200 using the saved configuration. The archive schema is **not installed remotely**. No remote migrations, account creation or historical uploads were performed. Hosted Auth/session persistence, Storage HTTP behaviour, email delivery and cross-account end-to-end upload isolation remain unverified until the setup steps are completed.
- `.env.local` is Git-ignored and untracked. A scan confirmed saved configuration values were not copied into source, documentation or tests. No service-role or AI credentials are used. No push or deployment was performed.

Local database tests use synthetic test-only users, not hosted accounts. The browser regression suite uses explicit demo mode on localhost:4100 and never seeds Supabase. Browser checks run Chromium rather than physical iPhone/Safari. A first sandboxed browser attempt was denied loopback/Chromium access; the checks ran with local execution permission. An initial concurrent test run collided in Playwright's shared artifact directory; final suites run sequentially.

Setup and exact manual migration/account/upload steps: [supabase-setup.md](supabase-setup.md). Existing prototype reports below describe demo behaviour only.

# Validation — first build

Validated locally on 31 October 2026 (Australia/Sydney), Node 24.14.1, npm 11.11.0, Next.js 16.4.3, React 19.3.1, TypeScript 6.0.3 and Tailwind CSS 4.3.3. Dependencies are pinned and the npm lockfile is included.

## Checks

- `npm run lint`: passed, no errors or warnings after cleanup.
- `npm run typecheck`: passed with strict TypeScript settings.
- `npm run build`: production compilation, type checks and 30 generated pages passed; final source rebuilt after UI refinements.
- `npm run test:e2e`: **17 passed** using installed Playwright Chromium. Tests live in `tests/archive.spec.ts`.
- Responsive tests: 14 representative routes at 320px, 375px, 768px, 1024px and 1440px. One h1 per route, successful HTTP responses, all visible source images loaded and no horizontal overflow.
- Interactions: archive query/type/person/deep-link filters, empty-state reset, unidentified-person filter, person navigation, letter page switching, original/transcribed modes, raw-text preservation after correction, native enlarged dialog/Escape, in-session comments, phone letter capture, page reordering/envelope role, JSON draft download, bulk batch Save & Next/export, phone navigation and unknown-record 404.
- Accessibility: axe WCAG 2 A/AA and WCAG 2.1 AA rule checks passed on home, explore, representative letter, people, capture, bulk and tree views. Labelled inputs, skip navigation, focus styles, reduced motion and keyboard tab controls are implemented.
- Visual inspection: desktop and mobile screenshots reviewed; collage caption adjusted to avoid source overlap, and a 320px explore-link layout issue fixed and covered by the suite. Fonts are self-hosted and asset credits are included.
- `npm audit --omit=dev`: **0 vulnerabilities**. The full development-tool audit reports 16 moderate findings propagated from a minimatch advisory in lint dependencies. No high/critical findings were reported. A forced downgrade of Next's lint configuration or incompatible minimatch override was not applied. Recheck upstream compatible fixes before the backend milestone.
- Source review: no credentials or real family data introduced. `.env*` files are ignored except an empty documented `.env.example`. No push, publication or deployment performed.

## Environment and limits

The first production build was blocked by the execution sandbox's local-port restriction during Turbopack CSS processing. The same build passed with permission to bind its worker port. This was an environment issue, not an application build failure.

Browser checks ran in Chromium, including emulated viewport widths; they do not substitute for testing an actual iPhone camera/Photos picker, Safari, VoiceOver or a screen reader. HEIC/HEIF previews depend on decoder support; unsupported local previews show a clear fallback and retain the selected original File. The capture attribute is a hint: phones decide whether to show the camera chooser.

The suite tests the visual prototype and in-memory behaviour, not Supabase security, storage durability, AI accuracy or native uploads. Those features are deliberately unconnected. This version must not be treated as an authenticated private archive. The RLS strategy and immutable-original design are proposals requiring actual implementation and isolation/restore tests before real use.

# Capture and administration extension — 31 October 2026

## Final validation

- Lint and strict TypeScript checks pass without warnings/errors.
- Production build passes: 37 generated pages, plus on-demand saved-capture and comparison-review routes.
- Full Chromium suite: **36 tests passed**. The original archive navigation/search/source tests remain, with the old capture test updated to the new flow.
- Responsive coverage retains 320/375/768/1024/1440px archive checks and adds capture/admin/comparison layouts at 375/768/1440px, including an active phone capture preview; no horizontal overflow was detected.
- Voice checks cover ready/recording/paused/recorded/transcribing/transcript-ready, real playback of the spoken fixture, edited vs raw text, retained audio reference, optional suggestion confirm/correct/remove and metadata export.
- Capture checks cover minimal metadata, immediate Save & next, camera file-chooser invocation in rapid mode, progress count, letter ordering/envelope roles, nonblocking jobs, object inscription views, per-page comparison review and raw-text preservation. A letter only leaves review when all its pages are reviewed.
- Administration checks cover role selection, optional same-person link, invitation creation and mock acceptance, duplicate invite detection, expiry/renew/revoke examples, member suspension/removal with attribution retained, owner protection, role gates, settings persistence, paused invitations, accurate metadata-only export and derivative retry state.
- Axe WCAG A/AA checks pass for the original representative routes, all six admin views, comparison review, active recording controls and the invitation dialog.
- Desktop/mobile screenshots inspected. The existing home and browse design is preserved; capture and administration extend the same visual system.
- A final focused voice regression additionally checks that clearing an edited transcript does not fall back to raw machine words when previewing suggestions. Both typed context and nonempty edited voice context may be interpreted together.
- New source was reviewed/scanned for credential patterns; no secrets or real family material were introduced. No commit, push or deployment was performed.

## Verification conditions and limits

Tests used the existing local development server on `http://localhost:4000`. A first attempt to start a second server for the repository was refused by Next's running-server lock. A loopback-origin attempt then displayed server-rendered pages but its HMR origin was rejected, preventing client hydration; using the server's localhost origin resolved this. `allowedDevOrigins` now also permits `127.0.0.1` for loopback test/dev access. Production and development outputs are separate, so the build was checked while the existing development server remained available.

Voice recording and transcription are explicitly mocked with a locally generated 8.6-second WAV. No actual microphone, speech service, handwriting provider or invitation email was used. Camera/file-picker checks use desktop Chromium; real iPhone capture, Safari, VoiceOver, microphone permission handling, interrupted native uploads, Supabase security and backup restoration remain unverified future work.

Client role gates are UX demonstrations, not server-enforced privacy. Session data clears on reload. Metadata JSON excludes original image/audio bytes and is not a complete backup. Server authentication, archive RLS, verified original receipts and durable processing must be implemented before adding private material.

# Archive-first adjustment — 31 October 2026

- The initial archive is **The Allen & Cork Archive**, using its existing immutable archive UUID and a separate, stable slug. The header has a restrained current-archive disclosure/switcher; there is only one provisioned archive.
- Lint, strict TypeScript checking and the production build pass. All **39 regression tests** pass: after the final export-ownership addition, 38 passed in the full run and the single-item export assertion passed on focused rerun after correcting its expected manifest shape.
- New coverage verifies independent Admin/Viewer roles for one profile across different archives, owner-only/suspended-membership filtering, rejection of foreign-archive ownership and duplicate slugs, the single-entry switcher, settings navigation/Escape, rename propagation, stable slug, creation date, cover/private-mode changes, and default permissions without changing existing member roles.
- Existing responsive checks cover 320/375/768/1024/1440px. Capture/admin layouts and accessibility remain covered. Phone and desktop screenshots of the name/switcher were visually inspected.
- Settings field names are concise for assistive technology, with separate descriptive help. The original archive/capture/member flows continue to pass.
- Historical fixture items/people/places/stories, processing/activity records, memberships/invitations and bulk draft exports carry archive identity. Capture export filenames now use `archive-draft.json` rather than a family-specific product label.
- Supabase remains unconnected. Additional archive creation, archive-qualified server repositories/routes, real privacy enforcement and durable persistence remain future work; adding switcher labels alone does not implement multi-tenant isolation. No secrets, push or deployment were introduced.
