# Supabase setup — persistent backend foundation

## Current status

SDK/SSR authentication, protected routes, archive bootstrap, memberships, people, item/recollection persistence, private-original uploads and database policies are implemented. The configured Auth endpoint was reached successfully without printing configuration or record data. **The remote database migrations have not been applied.** Four version-controlled migrations passed local PostgreSQL tests. They must be applied before archive queries/uploads can work.

No service-role key, database password, account password or AI key is needed in the browser. No fictional people or items are inserted by these migrations. The existing visual prototype is kept in an explicitly separate demo mode.

## 1. Local environment

Use the ignored `.env.local`, not a tracked file:

```dotenv
NEXT_PUBLIC_SUPABASE_URL=<your project URL>
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=<your publishable key>
```

`NEXT_PUBLIC_SUPABASE_ANON_KEY` is supported as a legacy alternative. These are Supabase's public client credentials, never a service-role/secret key. The app rejects secret-key prefixes and legacy service-role JWTs in this configuration. Do not paste values into documentation, chat, commands, test reports or tracked files. `.env.local` is ignored and was not committed. `.env.example` contains names/placeholders only.

Normal mode is **real**, requiring Auth. Missing/invalid configuration fails closed to setup/sign-in; database errors do not silently fall back to demo content. After changing environment values, restart `npm run dev`. Use its printed Local URL (the existing local server is on port 4000).

## 2. Apply the migrations — required manual step

The publishable key can use Auth and RLS-protected data APIs; it cannot apply DDL. No database password or CLI project link was supplied, so no remote DDL was attempted.

For the newly created project, open **Supabase Dashboard → SQL Editor**. Run these files in order, each once:

1. `supabase/migrations/202610310001_archive_foundation.sql`
2. `supabase/migrations/202610310002_private_ingestion.sql`
3. `supabase/migrations/202610310003_role_check.sql`
4. `supabase/migrations/202610310004_catalogue_updates.sql`

Each file is transactional. They add tables/functions/RLS and configure three private buckets. They do not drop tables, delete historical records, seed demo records or create accounts/passwords. Existing Auth users receive profile rows so accounts created before applying SQL also work. If you have already created conflicting tables, inspect the conflict rather than dropping them; these are first-install migrations.

Alternatively use the standard Supabase CLI with your own authenticated CLI session and database password entered via its secure prompts:

```sh
supabase login
supabase link --project-ref <your-project-ref>
supabase db push --dry-run
supabase db push
```

Do not pass passwords/tokens on the command line or add them to the repository. If SQL Editor is used, record the migration history in your deployment process before later CLI pushes; SQL Editor runs do not automatically populate CLI migration tracking. Do not blindly push the same first-install migrations twice.

Verify readiness with:

```sh
npm run check:backend
```

The command prints endpoint/schema readiness only, no URL/key or archive records. A schema check as anonymous does not prove authenticated RLS or upload correctness; the verification steps below still matter.

## 3. Configure Auth and create your own first account

In **Authentication → URL Configuration**, set Site URL to the actual local origin, for example `http://localhost:4000`, and allow `/auth/callback` and `/auth/confirm` URLs on that origin. Add the production HTTPS origin only when deploying. `supabase/config.toml` contains local development defaults, not remote dashboard settings.

Keep email confirmation enabled. For SSR email confirmation, the confirmation template can link to:

```text
{{ .SiteURL }}/auth/confirm?token_hash={{ .TokenHash }}&type=email
```

The app also supports PKCE `/auth/callback?code=...`. Redirect destinations are constrained to local application paths. The public sign-in UI uses Supabase Auth email/password; there is no custom password database.

Visit `/sign-in`, choose **Create an account**, enter your own name/email and choose your own password (at least 12 characters). Confirm your email, then sign in. No credentials have been invented or created for you. If project signup/email delivery is restricted, create/confirm the intended user through the project's Auth administration using your own chosen credentials. Built-in Supabase email restrictions may require verified project-team recipients or a configured SMTP provider; do not simulate delivery.

## 4. Create The Allen & Cork Archive

After signing in, an account with no accessible archives sees **Create a private archive**. Keep the suggested name and slug, or choose your own. Submission calls `create_archive` with the authenticated session. It atomically creates a fresh archive UUID and an active Admin membership for that caller; no email is hard-coded and no historical Person account is created. Pending/anonymous users cannot claim an existing archive.

The same account can create other archives through `/archives/new`; membership and privacy determine which archives appear in the switcher. Historical fixtures are never copied into these archives. Ownership references the first active Admin membership, and the database prevents that owner being demoted/suspended/removed by ordinary membership changes.

## 5. Test the first real upload

1. Sign in and create/select your archive.
2. Add to archive → Upload existing → choose a real JPEG/PNG/WebP/HEIC image, up to 30 MB. Captures support up to 20 images and 80 MB total.
3. Add a written recollection and optional People / When / Where context. Fields may be left blank.
4. Save & view. Wait for the explicit original upload/receipt step; it uploads exact original bytes, persists records/context and queues a display job.
5. Reload. Open Explore and the item. Confirm the source and recollection still exist. Download the original and compare its SHA-256 with your source file (`shasum -a 256 <file>` locally).
6. Sign out; the item URL and private file route must require sign-in. A different account without membership must not read it.
7. Interrupt a multi-file upload and retry on the same page with the same original files. Reservations and the capture UUID make retries idempotent; originals are never overwritten. Changed files use a new capture or produce a conflict instead of replacing bytes.

Network failure leaves recoverable database reservations/draft items; ready items alone appear in Explore. The current capture page keeps selected File objects on failure. Reloading clears an unsubmitted selection; it does not delete already preserved storage objects. A persistent offline/reselect/resume inbox is future work. An uploaded-but-unfinalised draft is visible only to its contributor/editors, not ordinary viewers. There is no automatic deletion of abandoned original objects in this stage.

Voice is still a labelled example. It is **not** uploaded or represented as a real audio recollection. The schema/private audio bucket are prepared, but audio capture/upload is not enabled yet. Live bulk ingestion is intentionally deferred; use the single-item/multi-page capture flow.

## 6. Storage and RLS

- `archive-originals`: untouched image originals; UUID-only archive/item/file paths, no filename-based paths.
- `archive-derived`: future display/thumbnail/transcription copies. No client writes until a processing worker is reviewed and connected.
- `archive-audio`: future immutable voice originals; not connected to the voice demo.

All buckets are private with file size/type restrictions. Source reservations are created by `begin_ingestion`; Storage INSERT checks active Contributor membership, matching reservation, author and owning archive. There is no authenticated UPDATE/DELETE policy, preventing ordinary clients from upserting, renaming or deleting source bytes. Download uses an authenticated server route and Storage RLS, with private/no-store caching and no shared Next image optimiser. Existing public demo images are unrelated fixtures, not imported source files.

The Node upload endpoint bounds multipart transport to 90 MiB even without Content-Length, sniffs file signatures, bounds source size/count, hashes raw bytes, uploads without upsert and confirms database/Storage receipts. SQL validates stored metadata size/MIME and finalises the item/recollection/job transaction. SHA-256 is calculated by the application over submitted bytes; the database does not itself re-hash Storage objects. Direct mobile/API implementations must follow the same validation/receipt contract. Checksums establish byte integrity, not historical authenticity.

Every archive table enables/FORCEs RLS; only narrow authenticated RPCs can write sensitive records. No service-role credential is used by the application. Definer helpers/RPCs are owned by the trusted migration role and have fixed search paths. Anonymous reads and cross-archive links are denied. See permissions.md for the role matrix and the actual migration/RPC list.

## Invitations, processing and operations

Member role/link/suspension/removal changes persist through an Admin-only RPC, while historical contributions remain. Secure invitation records/token storage are prepared, but delivery/redemption is not operational: the live Admin UI explicitly says so. To add a trusted development member before that feature exists, use a reviewed dashboard/SQL operation with the verified Auth user's UUID and desired archive role; never grant access by an unverified email or share a password.

Display jobs are durable but no worker is connected. The app says queued, never pretends images or handwriting were processed. AI transcription/metadata, facial recognition and restoration are off. Full backup export, ownership transfer, cover selection and broader place/story/tree editing remain separate milestones.

## Local verification

```sh
npm ci
npm run lint
npm run typecheck
npm run test:db
npm run build
npm run check:backend
LIVE_TEST_BASE_URL=http://localhost:4000 npm run test:auth
```

`test:db` runs the actual migrations in disposable PGlite PostgreSQL with minimal Auth/Storage schema stubs. It verifies RLS, grants, role boundaries, owner protection, metadata review restrictions, same-archive FKs, original immutability, retry/finalisation and database restart persistence. It is not a test of hosted Auth, Storage HTTP behaviour or SMTP. Real-project end-to-end upload verification requires the manual migration/account steps above.

To inspect the retained fictional UX without touching real data, start a separate explicit demo preview:

```sh
ARCHIVE_DEMO_MODE=true ARCHIVE_BUILD_DIR=.next-test npm run dev -- --hostname localhost --port 4100
TEST_BASE_URL=http://localhost:4100 npm run test:e2e
```

Demo mode never persists to Supabase and must not be used for private records. The separate build directory is ignored by Git/ESLint. Do not enable demo mode for a real private deployment. Production must use HTTPS and include session/Storage/backup/restore/isolation tests before importing a valuable collection.

Official implementation references: [Supabase Next.js SSR clients and proxy](https://supabase.com/docs/guides/auth/server-side/creating-a-client?framework=nextjs), [Storage access control](https://supabase.com/docs/guides/storage/security/access-control), and [Auth email templates](https://supabase.com/docs/guides/auth/auth-email-templates).
