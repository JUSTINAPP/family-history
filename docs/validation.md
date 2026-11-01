# Person relationships / legacy-photo split UX — release 010 validation, 1 November 2026

Base commit: `8df781c`. The user reports migration 009 is now installed in production. This release was developed and validated locally; no live project was accessed, no SQL applied remotely, and nothing staged, committed, pushed or deployed by the agent. Migrations 001–009 are byte-identical to HEAD. Only 010 is new.

- **225 disposable PostgreSQL checks passed** across actual migrations 001–010. The new checks cover relational Person IDs/multiple People, legacy text left unlinked, explicit linking preserving original reporter/name/time, link provenance, confirmation/removal, Person preservation, inline atomic creation, direct-write denial, Viewer/Contributor/Editor and cross-archive restrictions, archived-item visibility, verified/other-owner creation restrictions, and independent child catalogue/recollection/Person state after a split. A synthetic 82% metadata suggestion does not create an identification. Existing original-integrity, ingestion, split/delete and RLS checks remain.
- **198 checks passed with audio 006 initially absent**, followed by successful later installation of 006. These are disposable local PostgreSQL checks, not hosted Storage HTTP integration.
- **79 full regressions passed** against the explicit local demo server. This retains prior capture/bulk/audio/catalogue/image hierarchy/mobile/accessibility/origin coverage and adds partial-name matching and structured association selection: unlinked text, rejected reports and other items cannot create Person-filter matches. Command: `TEST_BASE_URL=http://127.0.0.1:4100 npm run test:e2e -- --output=/private/tmp/archive-person-regression-results`.
- **Production build, isolated traced HEIC decode and 2 authenticated production browser flows passed** with local synthetic Auth/PostgREST/Storage. The retained HEIC/image-set/split/delete recovery flow passes. The new flow explicitly tests Jina lookup and legacy linking, unchanged report attribution, separate Editor confirmation, multiple People, inline creation, removal without deleting Person, Person-page cards and relationship-only Explore filtering. It follows the prominent split CTA, tests the defer/retain shared-context choice, verifies no inherited recollections/People, catalogues one child independently and checks the other is untouched. Command: `TEST_HEIC_FILE=/private/tmp/archive-example.heic npm run test:previews`. The upstream sample is outside the repository; neither family original was downloaded or processed.
- **4 authentication tests passed** on the final `.next-test` production build with loopback fixture configuration. Command: `LIVE_TEST_BASE_URL=http://127.0.0.1:4200 npm run test:auth -- --output=/private/tmp/archive-person-auth-results`.
- **1 authenticated 1,007-item discoverability regression passed** against the local protocol fixture, including capped API pagination, item/edit reload and independent catalogue outage. Command: `npm run test:visibility`. The previous free-text catalogue label assertion now explicitly checks “Reported people notes (text)”.
- **Lint, strict TypeScript and `git diff --check` passed.** No dependency or environment/configuration change is required. Exclude generated `next-env.d.ts` from the commit.

The first new browser flow used a label selector that included a select's option text and timed out at Item type; the assertion now uses its accessible combobox role/name. The first full regression run encountered a detached invitation dialog during active development reloading. With source edits paused, the full unchanged suite passed all 79 tests. Final runs above completed successfully without weakening existing assertions.

The browser fixture proves real application wiring, not SQL permissions by itself; the actual SQL/RLS checks above independently cover those boundaries. Hosted Supabase, the actual family-item orientation/data and physical iPhone/Safari remain manual acceptance checks. [Release semantics, permissions and exact production smoke test](person-identifications.md) · [exact files to commit](person-identifications-commit-manifest.md).

# Individual-photo management / image optimisation — previous release validation, 1 November 2026

This section supersedes the earlier release summaries below for the current working tree based on `a2cf028`. Implementation was recovered after an IDE reload; completed work was retained. No remote SQL, production data/Storage mutation, staging, commit, push or deployment occurred.

- **77 full regression tests passed** on an explicit local demo server, including capture/bulk/audio/catalogue, source preservation, image variants, EXIF/HEIF orientation, visibility/pagination, mobile layouts, accessibility and request-origin checks. Command: `TEST_BASE_URL=http://127.0.0.1:4100 npm run test:e2e -- --output=/private/tmp/archive-management-regression-results` with `ARCHIVE_DEMO_MODE=true ARCHIVE_BUILD_DIR=.next-test` on the server.
- **4 authentication-boundary tests passed** against the final local `.next-test` production build configured with only loopback fixture credentials. They cover private pages (including item management/deletion progress), anonymous API rejection, cross-origin writes, safe redirects and mobile sign-in accessibility. Command: `LIVE_TEST_BASE_URL=http://127.0.0.1:4200 npm run test:auth -- --output=/private/tmp/archive-management-auth-results`.
- **Production build, isolated output-trace decode and 1 expanded authenticated browser integration passed** after the final loading corrections. Command: `TEST_HEIC_FILE=/private/tmp/archive-example.heic npm run test:previews`. The real application/decoder use synthetic loopback Auth/PostgREST/Storage. Coverage includes two independently preserved HEIC sources, failed download then Retry, image-set receipts, private variants, responsive thumbnails/placeholders, archive/restore, confirmed splitting, interrupted deletion recovery after reload, 97-item lazy-loading behaviour and signed-out asset denial. The upstream HEIC stays outside the repository.
- **Lint and strict TypeScript passed** again after the final corrections. `git diff --check` passes.
- **189 disposable PostgreSQL checks passed** in the recovered final database log, executing actual migrations 001–009, including SQL permissions/RLS, originals and hashes, one original per separate photograph, image-set receipts, split ownership/context preservation, archive visibility, deletion dependency gates, manifests/checkpoints, Storage policy checks and cleanup/restart. Migration 009 and these database files were not changed during recovery. These checks use Auth/Storage schema stubs, not hosted Storage HTTP.
- **16 targeted tests passed before interruption** (image hierarchy, preview/bulk, visibility and origin suites); those tests are also included in the final 77-test full regression pass.

The first recovery regression run exposed two new loading-boundary issues: Explore's fallback h1 briefly coexisted with the real page heading, and item loading streamed HTTP 200 before an unknown item's 404. The fallback now uses a status paragraph; the uncommitted item loading boundary was removed to preserve HTTP 404. Existing assertions were retained. An initial parallel Playwright invocation also collided in the default output directory; subsequent runs use separate artifact directories. One attempted rerun could not start because the user's normal Next dev directory was already in use; the successful run used the isolated existing `.next-test` dev directory. All final runs above completed successfully.

Migration 009 is complete and locally release-ready on the tested 001–008 baseline. Production history, backup/recovery readiness, hosted Vercel/Linux and Supabase Storage behaviour, actual family-image orientation/colour and physical iPhone/Safari remain manual acceptance checks. Installation does not repair/split/delete historical material automatically. The code requires 009 before deployment; do not casually roll back to the old single-display reservation code after responsive sets exist. Existing migrations 001–008 are byte-identical to HEAD.

The generated `next-env.d.ts` diff only points at the test build directory and is explicitly excluded from the proposed commit. No `tsconfig.json` change is required. [Exact reviewed commit manifest](item-management-commit-manifest.md) · [release order and exact manual production smoke test](individual-photo-management.md).

# Hosted HEIC preview repair — previous release validation

- Reproduced the old production-built API failure with a real photographic HEIC: Turbopack spread bare typed-array worker data into a plain object, and Buffer.from failed before HEIC decode. Direct source-worker conversion succeeded. The corrected named source envelope succeeds in the built application.
- Lint, strict TypeScript and the normal production build pass.
- **75 regression tests pass**, including actual HEIC conversion/container rotation, JPEG EXIF rotation, PNG/WebP, damaged input, previous capture/bulk/audio/catalogue/discovery/accessibility checks and public-origin validation. The first full run encountered a transient Next development JSON-manifest parse error on initial /people compilation (74 passed); the unchanged warmed-server full rerun passed all 75.
- **1 authenticated production-build preview flow passes** with the upstream libheif real HEIC sample (718,114 bytes; 1280×854). The build's isolated trace also produces a 351,967-byte JPEG with no repository-module fallback. Actual Retry buttons recover two source positions on one synthetic item after an injected read outage. Original hashes/downloads, two private derived records, detail, Explore, reload, completed-request idempotency and sign-out denial are checked. Auth/PostgREST/Storage are loopback protocol fixtures; the decoder and application are real.
- **126 disposable PostgreSQL checks pass**, executing actual migrations through new 008, including lease expiry/concurrency, stale-token rejection, failure recording, cross-archive/role gates, two-original receipts, empty-reservation recovery, immutable uploaded derivatives and source preservation. **99 checks pass with optional audio 006 initially absent**, followed by successful later installation of 006.
- **4 production authentication-boundary tests pass** on the normal local production build. The separate **1,007-row authenticated discoverability regression passes** after the fixture extension.

Migrations 001–007 are byte-identical to HEAD. No hosted archive data/Storage change, production-original download/conversion, Git staging, push or deployment was performed. Tests did not access either actual family HEIC. The upstream image stays in temporary storage and is not added to the repository. Hosted Vercel/Linux, the family's exact HEIC variants and physical iPhone/Safari remain unverified; use the [exact no-reupload production smoke test](hosted-heic-previews.md). [Files to commit](heic-preview-commit-manifest.md).

# Saved-item discoverability — current validation

The existing production item with two originals remains unchanged. The real app now uses paged RLS-visible catalogue queries, independent item lookup and resilient optional-resource loading. No new migration, production data change or automatic split was introduced.

- Lint and TypeScript checks pass; production build passes.
- The full regression suite passes **70 tests**, preserving photograph, HEIC, bulk, catalogue, audio and written-recollection coverage and adding visibility/pagination cases.
- `npm run test:visibility`: the authenticated real-data application path passes against an isolated synthetic Auth/PostgREST/Storage fixture. It verifies **1,007 visible rows despite a 127-row API cap**, null/empty metadata, failed previews, two original downloads on one item, edit/recollection controls, reload, sign-out/sign-in with a different default archive, View everything count equality and detail access during an independent catalogue outage. No real account/project or original was used.
- The disposable PostgreSQL suite retains **99 passing checks** for existing migrations/RLS/permissions/source preservation, plus **72 passing checks** with audio 006 initially absent. No policy was weakened or storage made public.
- **4 production authentication-boundary tests pass**. The production build now lists saved-item and Explore routes as dynamic per-request routes; no private item slugs are statically generated.

Early integration attempts exposed optional-resource GET backoff delaying detail rendering and a dependency on next-catalogue availability blocking the edit page. These were fixed rather than hidden behind longer browser-test waits. The test's selectors were also aligned with the existing sign-in form. Optional requests now fail independently and the final authenticated flow passes.

A final repeated run exposed a synthetic-audio fixture timing issue: its elapsed timer could reach one second before the encoder produced any data. The fixture now retains its Web Audio producer and waits for an actual dataavailable chunk before Pause/Stop; production recording code is unchanged.

Hosted production HTTP behaviour and physical Safari/iPhone still need the [no-reupload smoke test](saved-item-discoverability.md). The agent did not independently access the user's private production session or inspect its failing request trace; production facts are those supplied by the user's database inspection. [Combined commit manifest](visibility-commit-manifest.md).

# Bulk photograph ingestion correction — current

- The user confirmed from production database inspection that **two original-file rows belong to one archive item**. The grouping explains the single Explore entry. The agent did not independently inspect/download the current private Storage objects, execute the read-only audit remotely, or generate a production HEIC derivative. No existing item/source was moved, deleted, split or re-uploaded.
- Lint and strict TypeScript pass. Production build passes with import history, persisted progress, batch-scoped galleries and catalogue context saving.
- **66 regression tests pass**, retaining the previous photograph/HEIC/audio/written-recollection suites. New checks cover 2 and 20 separate import calls, file transfer from the capture intention prompt, explicit front/back grouping, metadata-free completion and two Explore entries, batch-context separation, reload/reselection matching and mobile accessibility.
- **99 disposable PostgreSQL checks pass** across migrations 001–007. New cases create twenty independent ready items and originals, assert zero automatically copied recollections, enforce expected batch count, preserve grouped letter/photo files, verify per-archive and Contributor/Editor gates, verify atomic/idempotent catalogue words, select the next uncatalogued photograph, and read complete scoped galleries without requiring a derived preview.
- **72 checks pass without audio 006 initially installed**: a fresh disposable database executes 001–005 and 007, runs the relevant suite, then successfully applies 006 afterwards. These are local-only migrations, not reruns on production. 007 is independent of 006.
- **4 production-mode authentication tests pass** locally, including private import history/progress, scoped Explore, existing source/audio/preview routes and cross-origin write rejection.
- A first new grouped-source browser assertion expected two list containers, while the UI correctly contains two download links inside one container. It was corrected to check both original filenames. All subsequent regression checks pass.

The bulk pass leaves migrations 001–006, real originals, existing audio work and Git staging untouched. Migration 007 is new and has not been applied remotely. Physical iPhone/Safari, large hosted uploads, interrupted real-network resume and the actual existing HEIC derivative remain deployment smoke-test tasks. Source/data integrity is protected in local tests; the current physical production objects are not claimed independently audited from row metadata alone.

See [confirmed finding, workflow, recovery and deployment order](bulk-photograph-import.md) and the [combined commit manifest](bulk-import-commit-manifest.md).

# Archival audio — current validation

- Lint and strict TypeScript checks passed.
- Production build passed with voice capture, recording metadata edits, authenticated audio finalisation and private playback alongside the existing HEIC/bulk/catalogue routes.
- **60 regression tests passed**: the previous 52 remain, plus five audio upload/validation/range checks and three browser recording/upload/permission/accessibility checks. The browser recorder test feeds a synthetic Web Audio stream into the actual MediaRecorder; Record, elapsed time, Pause/Resume, Stop, local playback/bytes, Delete and zero uploads before explicit Save are exercised. No real microphone or hosted test upload was used.
- **82 disposable PostgreSQL checks passed**, executing migrations 001–006 only in a fresh local test database. New cases cover attached audio, metadata-free standalone oral histories, idempotent receipts, private Storage reads, role/owner edits, same-archive links, Editor changes, archive/restore visibility, original immutability, speaker credits without profile email exposure, audio-context hiding and preservation of separate written recollections. New tables have ENABLE/FORCE RLS and explicit grants.
- **4 production authentication tests passed** on localhost:4200, including voice and recording-edit route protection, anonymous audio-finalisation rejection, cross-origin rejection and existing private-file/preview boundaries.
- Migrations **001–005 were not modified**. Migration 006 has **not** been applied remotely. No remote data/Storage mutation, Git staging, commit, push or deployment occurred. The pre-existing `next-env.d.ts` change was excluded from the commit manifest.

The first Chromium synthetic-device attempt stalled in the macOS microphone-permission path. The final recorder test injects an in-browser synthetic stream, avoiding device permission/real audio access while still using the real encoder and controls. A denial assertion was narrowed to the application's alert to avoid Next's separate route-announcer alert. The final suite passes.

Physical iPhone/Safari, actual hardware microphones, background/screen-lock/phone-call behaviour, imported M4A/MP3 variants, large hosted uploads, signed-link expiry/renewal and production Vercel/Supabase playback still require the [audio deployment smoke test](audio-recordings.md). Local tests cannot prove hosted end-to-end capture. Audio remains in its original codec; unsupported players can download the master. Signed URLs expire after ten minutes and can outlive revocation until that expiry.

Exact combined file list and actual starting Git state: [audio commit manifest](audio-commit-manifest.md).

# HEIC / bulk import / catalogue editing — 31 October 2026 (current)

This follow-up supersedes earlier statements that bulk/preview processing is unconnected or that the live archive has not been created. The user has confirmed the live archive exists. No remote database or Storage changes were performed in this pass.

- Lint and strict TypeScript: passed.
- Production build: passed, with Node private-preview routes and catalogue editing. Output traces include the standalone preview worker, libheif decoder, Sharp renderer and installed platform codec binaries. Linux/Vercel execution is not proven by a local macOS build.
- Regression suite: **52 passed** on explicit demo localhost:4100. This retains the original 39 UX checks and 6 existing upload tests, adding real HEIC browser decoding/failure states, deterministic JPEG conversion, EXIF rotation, metadata-free bulk import, stable partial-failure retries and HEIF container validation.
- Production authentication suite: **4 passed** on localhost:4200. Checks include anonymous private page/API rejection, private preview GET/POST rejection, cross-origin mutation rejection, safe redirects and mobile sign-in accessibility.
- Disposable PostgreSQL: **54 checks passed** across all five actual migrations. Added checks cover source/display parent linkage and ordering, preview reservation/receipt retry, recovery by a different Editor, read-only source policies, contributor own-item editing, foreign-archive denial, verified-item protection, metadata-free ready items, provenance actor/time and retention of original recollection/hash.
- The HEIC fixture is a locally generated plain red field, not user material. Both its input checksum and output dimensions/colour are asserted. The existing IMG_6390.HEIC was not downloaded or converted by the agent; its exact orientation/colour and the hosted Supabase/Vercel flow require the deployment smoke test.
- `.env.local` remains ignored/untracked, with no saved configuration values copied into source/docs/tests. No AI service, remote account, fictional seed, source replacement, Storage deletion, push or deployment was performed.

Only additive follow-up migration **202610310005_previews_and_cataloguing.sql** should be applied to the existing archive. Do not rerun first-install migrations. See [setup and deployment smoke tests](preview-bulk-cataloguing.md) and the [commit manifest](preview-bulk-commit-files.md).

The initial regression rerun caught an outdated test-double query chain after original-purpose filtering was added; the mock now applies named filters, and the final suite passes. Browsers require sandbox permission for Chromium/loopback. No physical iPhone/Safari/HDR display, remote archive session, large real-world batch or Vercel codec runtime was exercised. Failed/unfinished previews leave originals usable and independently preserved. Offline/reload-resumable batches remain future work; retries within the same open batch retain capture IDs.

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
