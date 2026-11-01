# Inline Family Conversation — 1 November 2026

This refines the existing migration 012 comment/reply system. It adds no parallel comments model, reaction system, migration, dependency or environment setting. Migrations 001–014 are unchanged. No production project, hosted family material or AI provider was accessed; nothing was committed, pushed or deployed.

## Everyday interaction

Live Explore cards start with a quiet Add a comment / 1 comment / N comments **button**. There is no initial comment body, preview snippet or composer for each card. Clicking or pressing Enter expands Family Conversation beneath that card without changing the URL. Clicking Hide conversation closes it with focus returned to the same button. The button shows an updated count while open. Loaded threads and unsent drafts remain mounted but hidden on collapse, so reopening does not discard the user's words.

Explore uses stable row-based cards (four/three/two columns and one column on narrow phones). CSS newspaper columns could rebalance the whole collection when an inline thread grew; the row layout keeps the selected card in place and lets content grow below it. Card images still open the item normally. The homepage scrapbook composition is unchanged: it retains only its quiet count/deep link to `/archive/<id>#family-conversation`.

The same FamilyConversation and CommentComposer render on Explore, item detail (expanded by default) and Quick Catalogue. Comments show name, date/time, body and Reply; authors can edit their own comments. Editor-only options retain archive/restore and deliberate copying into a formal recollection. Other members' edit controls are absent and the existing SQL still rejects forged edits. Moderated bodies/state are hidden from ordinary members. There is no automatic conversion of chat into canonical metadata or recollections.

Reply opens a focused small composer directly beneath its root comment, with one indented reply level. It does not create a second discussion tree. A root composer remains at the bottom. On success the saved canonical row updates local state and the count, clears the input and retains the page/scroll context. Inputs retain focus without imperative scrolling; failure retains words and the retry ID. No speculative row is invented before server acknowledgement. Saved UUID/revision upserts avoid duplicates and merge concurrent composer responses against current session state.

Normal post/edit/moderation returns the saved row from the existing authenticated server action, without `router.refresh()` or layout revalidation. The one deliberate exception is Editor promotion: it also refreshes the separate server-rendered recollection section, preserving the conversation and original attribution. Person/date/Place saves and normal item editing remain independent.

## Retrieval, session cache and permissions

Initial Home/Explore payloads keep the existing batched active-comment counts from migration 014; they do not fetch every comment body. Only expanding a thread invokes the new read-only `GET /api/v1/conversations/<item-id>?archive=<archive-id>` endpoint. It authenticates, checks a readable same-archive item through RLS, and paginates only that item's RLS-readable comments. Responses are `private, no-store` with Cookie/Authorization variation. Signed-out requests return 401; an inaccessible/mismatched item returns 404 without disclosing its conversation.

The in-memory cache belongs to a mounted authenticated archive workspace, keyed by profile/archive and then archive/item. It is not process-global, localStorage or a cross-user HTTP cache. Concurrent opens deduplicate the same pending request. Reopening within 30 seconds reuses saved rows; older entries revalidate on expansion, with writes disabled while refreshing. A full reload/navigation to a newly mounted workspace loads fresh server state. Mutations upsert canonical rows immediately; cached rows are not treated as authorization for a write. Session/archive changes discard the provider cache.

Item detail can use its existing server-provided conversation; Quick Catalogue retains its batched visible-group retrieval. Both seed the same local-state component. The server action binds existing-comment operations to archive and item before invoking unchanged ownership/revision/lifecycle RPC checks. Existing one-level reply validation, idempotent write IDs, audit and Editor promotion behaviour remain in force. No new write API bypasses them.

## Manual release and exact production smoke test

**No Supabase SQL action is required.** The existing application baseline through 014 remains a prerequisite; do not rerun installed migrations. Review the commit and deploy only through the separately approved release process.

1. As a permitted member, open Explore with zero-, one- and multiple-comment photographs. Verify quiet accurate counts, no permanent forms, and no comment-body requests until expansion in browser Network tools.
2. Click a count and also test keyboard Enter. Verify the URL/image position stay unchanged, only that item's conversation loads, and the image link still opens its normal item page.
3. Post a disposable comment. Verify immediate local display/count after save, cleared focused input and no navigation/full-page refresh. Close/reopen: verify the new count and no duplicate request within 30 seconds. Leave an unsent draft, collapse/reopen and verify it survives.
4. Click Reply beneath a root. Verify focus enters the nearby input, the reply saves indented under its parent, and replies cannot acquire another nested reply level.
5. Edit your own comment and reload to verify persistence/raw discussion attribution. As a different member, verify no own-edit control on that comment; forged cross-member/cross-archive operations must fail.
6. Open the normal item and Quick Catalogue. Verify the same composer/reply actions work without a recollection or navigation, and Quick Catalogue can move to the next image/back with locally saved comments retained.
7. As Editor, deliberately Keep as a recollection. Verify a separate attributed recollection appears and the original comment remains. Verify ordinary posting never creates a recollection or canonical Person/Place/date change.
8. Check Home's clean scrapbook count link still opens the item at Family Conversation. Its card composition should remain unchanged.
9. On a physical phone, expand a thread, open the keyboard, post/reply/edit, collapse and continue browsing. Check scroll/focus, touch targets, long text, portrait/landscape and no horizontal overflow. Browser 375px checks do not emulate a real software keyboard.
10. Sign out and request the conversation endpoint/private item. Verify denial and no previous user's cached thread on a new login. Switch archives/accounts and verify isolation. Test a temporary read/write failure: retry feedback must retain unsent words and avoid duplicate saved posts.

See [validation](validation.md) and [exact commit manifest](inline-conversation-commit-manifest.md). Hosted latency, multi-device simultaneous updates and physical-phone keyboard behaviour remain manual acceptance checks.
