# Supabase foundation

The first four ordered migrations implement the persistent archive foundation, private Storage, RLS and narrow authenticated RPC writes. They contain no fictional archive people/items, admin email or passwords. `create_archive` bootstraps a fresh archive and its authenticated caller's Admin membership atomically.

Read [setup](../docs/supabase-setup.md) before applying. The remote project is reachable, but no migration has been applied remotely in this session. The publishable key cannot perform schema administration; apply through the SQL Editor or your authenticated CLI/database access. No destructive remote operations were attempted.

Run `npm run test:db` to execute the actual SQL in disposable local PostgreSQL with Auth/Storage schema stubs. These tests verify policies/roles and database persistence, not hosted Auth or Storage HTTP behaviour. `npm run check:backend` prints readiness only, never configuration values or record contents.

Tables and file rows use archive_id as the ownership boundary. Global profiles and archive-local memberships stay separate from historical People. Originals, derived assets and future audio use private buckets. No AI worker, mail invitation delivery or audio capture service is connected.

The user has confirmed the existing live archive is created. Apply **only** `202610310005_previews_and_cataloguing.sql` there, never rerun the first-install migrations. It adds private display reservations/receipts, purpose-aware file ordering, catalogue provenance and own-contribution editing. No existing object or row is deleted or rewritten. See [follow-up setup](../docs/preview-bulk-cataloguing.md).
