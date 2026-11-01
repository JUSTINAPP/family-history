# Supabase foundation

**Current release — migration 014:** Adds source-image presentation rotation, a narrow permission/version-checked rotation RPC and batched conversation counts. No Storage or master-byte operation occurs. Confirm the installed 001–013 baseline before manually applying only missing 014; earlier migrations are unchanged. See [model, permissions and manual smoke test](../docs/conversation-and-image-rotation.md). No production SQL was run by the agent.

**Current release — migration 013:** Adds document-processing attempts and extends existing transcription/suggestion/review provenance, with permission, claim and lifecycle guards. User approved 013 to preserve committed 012. Confirm the actual installed 001–012 baseline, then manually apply only missing 013 before app deployment. No AI calls, original rewrite or Storage operation occurs during installation. See [configuration, read-only markers and exact smoke test](../docs/document-processing.md). No production SQL was run by the agent.

**Current release — migration 012:** Reuses comments for private family conversation and adds independent date/caption RPCs, six date precision choices, shallow replies, own-comment editing, Editor moderation and explicit copying into recollections. Verify the installed 001–011 baseline, then manually apply only missing 012 before the app release. No automatic historical interpretation, Storage changes or notification delivery. Migrations 001–011 are unchanged. See [schema/permissions, read-only installation markers and exact smoke test](../docs/quick-catalogue-conversation.md). No production SQL was run by the agent.

**Living scrapbook follow-up:** No SQL changes or new migration. The existing 011 Places schema remains the prerequisite; do not rerun it if installed. The simpler separation UI uses the unchanged version/permission-checked 009 RPC, and deliberate shared-note/Person copying uses existing authenticated RPCs. See [current release and manual verification](../docs/living-scrapbook.md).

**Current release — migration 011:** Adds archive-scoped Places and item associations with RLS/narrow RPCs, preserves Where text, and integrates association cleanup with the existing deletion preflight/lifecycle. Confirm the 001–010 baseline before manually applying only 011. No automatic backfill or Storage change occurs. See [manual installation and smoke test](../docs/archive-places.md).

**Current release — migration 010:** Reuses item/Person `identifications`, retaining original reports and adding explicit link/review provenance. Requires the established baseline including 009. No historical name matching or automatic split occurs. See [release order and smoke test](../docs/person-identifications.md); do not rerun older migrations.

**Current release — migration 009:** [Item management and responsive image sets](../docs/individual-photo-management.md) supersedes the earlier release instructions below. The actual migrations through 009 passed 189 disposable PostgreSQL checks. Confirm the installed 001–008 baseline before manually applying only missing migrations; do not rerun installed SQL. Installation does not split historical items or delete Storage objects. The new code requires 009. No remote SQL was applied by the agent.

**HEIC preview repair:** New additive migration **008** records per-original attempts and processing failures. It depends on the existing 001–005 preview foundation and is independent of optional 006/007. Do not rerun earlier migrations. See [manual deployment and no-reupload smoke test](../docs/hosted-heic-previews.md).

**Bulk-photograph correction (current):** Production inspection confirmed two originals grouped under one item. Capture now explicitly distinguishes one item’s views from separate photographs, with durable import batches and separate batch context. Apply only new migration **007** for bulk; it works without audio migration 006. Existing production sources are unchanged. See [workflow, audit and deployment](../docs/bulk-photograph-import.md).

**Audio follow-up (current):** Real microphone/file recording, attached voice recollections and standalone oral histories are implemented locally. Migration 005 is already applied. Apply **only migration 006**, manually, before deploying audio. See [audio setup, permissions and smoke tests](../docs/audio-recordings.md). No remote SQL/data changes were made in this pass. Earlier references to demo-only voice describe the retained prototype.

The first four ordered migrations implement the persistent archive foundation, private Storage, RLS and narrow authenticated RPC writes. They contain no fictional archive people/items, admin email or passwords. `create_archive` bootstraps a fresh archive and its authenticated caller's Admin membership atomically.

Read [setup](../docs/supabase-setup.md) before applying. The remote project is reachable, but no migration has been applied remotely in this session. The publishable key cannot perform schema administration; apply through the SQL Editor or your authenticated CLI/database access. No destructive remote operations were attempted.

Run `npm run test:db` to execute the actual SQL in disposable local PostgreSQL with Auth/Storage schema stubs. These tests verify policies/roles and database persistence, not hosted Auth or Storage HTTP behaviour. `npm run check:backend` prints readiness only, never configuration values or record contents.

Tables and file rows use archive_id as the ownership boundary. Global profiles and archive-local memberships stay separate from historical People. Originals, derived assets and future audio use private buckets. No AI worker, mail invitation delivery or audio capture service is connected.

The user has confirmed the existing live archive is created. Apply **only** `202610310005_previews_and_cataloguing.sql` there, never rerun the first-install migrations. It adds private display reservations/receipts, purpose-aware file ordering, catalogue provenance and own-contribution editing. No existing object or row is deleted or rewritten. See [follow-up setup](../docs/preview-bulk-cataloguing.md).
