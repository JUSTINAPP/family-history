# Quick catalogue and family conversation — release 012

Base: `6210226`. Implemented locally on 1 November 2026. The existing scrapbook, independent photograph imports, People and Places are retained. No production project, Storage object or family original was accessed or changed. Nothing was staged, committed, pushed or deployed by the agent. Migrations 001–011 are unchanged.

## Independent contributions

People and Place selection already used their own authenticated RPCs; neither required a recollection. They now acknowledge ordinary saves with **Person saved** / **Place saved** in the family view. Removing a mistaken link still follows existing author/Editor permissions; confirmation and original evidence remain under expandable details. Sequential selections support multiple People and inline creation reuses the established picker.

New **When** and **Caption** controls save only their own field through `save_item_field`. They do not submit other metadata, require a memory or mark an incomplete photograph fully catalogued. Expected previous field values are captured when editing starts, so even a background refresh cannot make an old draft appear current or silently overwrite another tab/member’s save. Date edits leave captions/notes/Place/People/recollections unchanged and vice versa. The existing broader editor remains available; it preserves the new precision values too.

When supports exact ISO date (`1984-03-12`, with a native date picker), month/year (`1984-03`), year (`1984`), approximate year (`c. 1984` displayed; `1984` entered), decade (`1980s`) and unknown. Invalid calendar dates and false precision are rejected. Existing free-text historical dates are retained until someone deliberately changes them. Canonical text and precision remain separate; no comment or memory is parsed into metadata.

## Quick catalogue

Explore offers **Quick catalogue**. The live route is scoped to the selected archive. It loads twelve photographs per working group, with a small current photograph, lightweight Who / When / Where controls, optional caption editing, conversation and a visual thumbnail chooser. Next/Previous work within and across groups; Next needing information chooses a later photograph lacking a Person, a structured Place or a date. The separate needing-information queue can find more. This is a navigation aid, not a requirement to fill every field or add a memory.

Navigation stays available while scrolling on a phone. Changing photographs returns the image to view. Buttons have touch-sized targets, no hover requirement and the current position is announced. Full record remains a deliberate link; identifying a series does not require opening and closing full records. Deliberate navigation away from a photograph can discard unsaved draft text; successful field/comment writes have already persisted independently.

## Conversation, replies and memories

The existing `comments` table supplies the archive/item, author, text and original timestamp. Migration 012 adds optional same-item parent ID, edit timestamp, revision, archive timestamp/actor and a client write ID. One-level replies are enforced inside the mutation RPC; replies to replies, foreign-item parents and archived parents are rejected. A compound same-item FK also protects ownership. Sorting retains original timestamps rather than moving edited comments to the end.

**Family conversation** displays each speaker and timestamp separately, with a shallow indented reply and an edited marker. Authors can edit only their own unarchived comments. Revision checking rejects stale writes. Stable client write IDs make posting retries idempotent; changed retry text asks the user to reload/review rather than silently creating duplicates. The UI keeps drafts on failure and acknowledges saves only after the server succeeds. Responses become visible on the next page refresh/mutation refresh; there is no realtime subscription or notification delivery in this release.

Editors/Admins can archive/restore comments, including individual replies, without changing the speaker's words. Ordinary readers cannot retrieve an archived body; authors and Editors retain backend read access. Replies whose root is hidden get a neutral “Earlier comment unavailable” heading. Comment edit/moderation provenance is restricted to its actor, original author and Editors; original body/author/time are preserved in the audit. No direct table write grants are added.

**Add a memory** is a distinct, deliberate recollection form; it is never a prerequisite for People, dates, Places or comments. Existing private voice capture is reachable as **Add a voice memory**, with no transcription/AI requirement and unchanged audio-master preservation. Editors can select **Keep as a recollection** from a comment's options. It copies the reviewed revision once, preserves the original speaker/time, records the Editor's decision and source comment/revision in provenance, and keeps the conversation intact. Later comment edits do not silently rewrite the copied recollection. There is no automatic metadata extraction or conversation-to-memory conversion.

Stable author/item/archive IDs, parent IDs, timestamps and revisions support a future notification recipient lookup. No email, push, external messaging, AI service, notification preference UI or new social graph is introduced.

## Ordinary item detail

The normal sequence is image, Who, When, Where, What we know, Family conversation, Add a memory and optional voice memory. Person/Place report states and confirmation are under expandable details. Raw Where/name wording, catalogue state, technical date precision, source sizes/checksums and original-file information are under Archive information / Original file information. Editors retain catalogue, split, moderation and deeper management controls. Existing archival evidence is retained; the simpler presentation does not assert certainty.

## Permissions

| Role | Conversation | Metadata / memory |
| --- | --- | --- |
| Viewer | Read permitted active comments/replies; no posting under existing role policy | Read only |
| Commenter | Post/reply, edit own comments | Existing memory/identification reporting permissions |
| Contributor | Same conversation rights; cannot edit another member's comment | Existing Person reporting; date/caption/Place edits and inline Person/Place creation on eligible own ready, active, unverified items; deliberate recollections |
| Editor / Admin | Post/reply/edit own; archive/restore and copy to a recollection | Existing canonical review/edit permissions |

Membership, item readability, lifecycle and same-archive checks run in SQL as well as the UI. Verified records still require Editor metadata editing. New posting is blocked on archived/deleting/unready items; signed-out and cross-archive access fails closed. No service-role credential is used. Existing permanent deletion removes a complete comment thread atomically; the self-FK is part of the already reviewed comments dependency, with no new dependency table to hide from preflight.

## Performance and privacy

Quick catalogue uses only existing small derivatives (maximum 600px), stored LQIP, lazy thumbnail loading and no original/display fallback or on-demand conversion. The current photo is loaded eagerly; its height is bounded on phones. An absent small receipt shows Preview unavailable and does not pretend a conversion is running. Navigating between photos within a group uses already-batched context. Page links disable speculative prefetch.

The established request-scoped workspace loader supplies archive material/People/lean associations/image sets. Place reads are batched and cached per request. Full identification control context and comments are fetched with an archive filter plus the twelve visible item IDs, pagination and exact counts, rather than a request per photograph. Comment bodies from unrelated items are not put into the quick payload. The shell does not reload the catalogue. Existing private asset authentication/RLS, ETags and permission-before-304 behavior are unchanged.

Browser query assertions cover one comments request per group load, one People/Places/membership read and paginated identification reads (archive links plus one group read). This measures HTTP requests; database RLS internals and hosted latency are not inferred from loopback timings. An early missing count caused an extra empty pagination probe; exact counts remove that request. The offscreen-image fixture now orders its uncached last card deterministically instead of relying on random UUID order.

## Migration 012 and manual Supabase action

New file: `supabase/migrations/202611010012_quick_catalogue_and_conversation.sql`. It is enclosed in **BEGIN / COMMIT**. It extends the existing date precision constraint and comments table, replaces the legacy comment-write wrapper with the same validated boundary, narrows archived-comment/audit reads and adds four authenticated-only mutation RPCs. It introduces no new table, historical text interpretation, automatic recollection, Storage operation or notification delivery. Existing rows retain their authors/text/timestamps; the new comment revision defaults to 1.

Before deployment, manually confirm the established migration baseline through **011**. Apply **only 012**, once, through the normal reviewed Supabase process, before deploying the application change. Do not rerun installed migrations or rewrite old SQL to conceal an incomplete baseline. This agent did not inspect or apply the live schema. If any 012 objects already exist, reconcile their exact definitions before attempting installation.

This read-only signature check can help identify installation markers, but does not replace checking the complete baseline:

```sql
select
 to_regclass('public.import_batch_items') as migration_007,
 to_regclass('public.preview_attempts') as migration_008,
 to_regclass('public.image_sets') as migration_009,
 to_regclass('public.places') as migration_011_places,
 to_regclass('public.item_places') as migration_011_links,
 to_regprocedure('public.save_item_field(uuid,uuid,text,text,text,jsonb)') as migration_012_fields,
 to_regprocedure('public.post_item_comment(uuid,uuid,text,uuid,uuid)') as migration_012_posts,
 to_regprocedure('public.change_item_comment(uuid,text,text,integer)') as migration_012_changes,
 to_regprocedure('public.promote_item_comment(uuid,integer)') as migration_012_promotion;
```

## Final validation

| Check | Final result |
| --- | --- |
| Lint / strict TypeScript / whitespace | Pass |
| Production build / isolated traced HEIC decoder | Pass |
| Full regression suite | 92 passed |
| Authenticated production browser flows | 6 passed |
| Authentication boundaries | 4 passed |
| Actual migration/permission/lifecycle SQL | 306 checks passed |
| Optional-audio baseline | 279 checks passed; later 006 install also passes |
| Authenticated discoverability | 1 flow passed with 1,007 items |

No local validation blocker remains. Remote installation and the hosted smoke test are manual and have not been performed. See [validation details](validation.md).

## Exact production smoke test after deployment

Use disposable test photographs and two ordinary family accounts plus an Editor. Keep real historical material and the legacy Jina group unchanged during testing.

1. Confirm 012 is installed after the verified 001–011 baseline. As an Editor open Explore → Quick catalogue on desktop and a 375px phone. Check image/Who/When/Where, sticky Next/Previous, the thumbnail chooser and no horizontal overflow. Select the twelfth photo, then Next to cross into the next group; return with Previous.
2. On a test photograph with no recollection, select an existing Person. Confirm **Person saved**, reload and verify the association persisted. Add another Person, remove the mistaken one and inline-create a minimal Person. No date, Place, caption or memory should be required.
3. Search/select a Place, then test inline creation on another test photo. Confirm **Place saved** and persistence after reload, with no recollection required. Existing Where wording and unrelated fields must remain unchanged.
4. Save an approximate year using `1984`; verify `c. 1984`. On test photos check year, month/year, exact date, decade and unknown. Save a caption independently. Reload and confirm no unrelated field/recollection changed. With the same field open in two tabs, save in one, then try a stale save in the other: it must request reload rather than overwrite silently.
5. Use Next needing information, Next, Previous and the chooser to work through several photos. Open Network: only small/thumbnail-sized material should be downloaded in Quick catalogue, with no original or 2400px display request. Throttle to see placeholders and scroll for lazy thumbnails.
6. As account A post a comment; as B reload and reply. Verify distinct names/timestamps and one-level indentation. A cannot edit B's contribution. Edit A's comment and verify the edited marker while its original timestamp remains. No formal recollection should appear automatically.
7. As Editor select Comment options → Keep as a recollection. Confirm the original comment remains and the recollection keeps its speaker/time. Repeating the action must not duplicate it; later comment edits must not rewrite the copy. Date/Place still change only through a deliberate human save.
8. As Editor archive a test root comment. Verify ordinary account B cannot retrieve its body, while a remaining reply has a neutral unavailable-root heading. Restore it as Editor. Recheck that an ordinary member cannot moderate another member's comment.
9. Open the full item: image/Who/When/Where/memories/conversation are primary; catalogue state and checksums are collapsed. Add a separate written memory and, where device permissions allow, a private voice memory without transcription. Existing People/Place pages and filters should still show real relationships.
10. Switch archives and verify no conversation/People/Place leakage. A Contributor can edit dates/Places on eligible own items and cannot overwrite another contributor's canonical fields. A Viewer can read but cannot post under the existing policy. Sign out and retry Quick catalogue, item pages and a saved private asset URL/ETag: no private data or signed-out 304 may be returned.

No permanent deletion is needed for this manual smoke test. Hosted Supabase behavior, real family-image diversity and physical Safari/voice permissions still require human acceptance; local fixtures are not evidence of deployment latency.

Validation results and exact proposed files are recorded in [validation](validation.md) and the [commit manifest](quick-catalogue-conversation-commit-manifest.md).
