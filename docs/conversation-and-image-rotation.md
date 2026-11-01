# Family conversation, Quick Catalogue and image rotation — release 014

Family Conversation, shallow replies and independent catalogue saves reuse release 012. The item page now puts Family conversation first in the context column beside the image, before Who/When/Where and archival notes. It is always expanded; posting/replying requires no Edit catalogue or recollection save. Card links target the stable `#family-conversation` anchor. On phones this column follows the source images.

Scrapbook photograph composition remains unchanged. A small text count (including replies) links straight to conversation; an empty ready item's link says Add a comment. It works without hover. Explore uses the same indication. Unavailable counts are omitted rather than misreported as zero. Moderated/archived comments are excluded. Viewers can read conversation but cannot post; existing Commenter/Contributor/Editor rules continue to govern writes.

Quick catalogue now sits beside the Explore heading, and Home has Help identify photographs. The existing groups of twelve remain, with their six-column desktop/four-column phone thumbnail selector moved above the active photograph/controls so several images are immediately scannable. Choosing a thumbnail, Previous/Next and Next needing information reuse the existing rapid workflow. Who, date/precision, Place, caption and comment still save independently, with no required recollection. Open full record remains available.

## Non-destructive orientation

Only migration **202611010014_image_rotation_and_conversation_counts.sql** is new. Migrations 001–013 are unchanged. It adds `archive_item_files.presentation_rotation` constrained to 0/90/180/270 degrees, an expected-version rotation RPC, and a security-invoker aggregate view for batched conversation counts. It extends the security-invoker current-image-set view to include the original's presentation rotation. No Storage object or original checksum, EXIF, byte size, path or derivative manifest is rewritten during installation or rotation.

Image options → Rotate left/right is available on ready, active, unarchived item photographs and each document page, and on the selected Quick Catalogue photograph. Editors/Admins can rotate eligible items. Contributors can rotate their own unverified eligible contributions; other Contributors, Viewers, Commenters, signed-out and foreign-archive users cannot. The database enforces these rules independently of controls. Rotation saves immediately through a narrow authenticated server action, with feedback and refresh. A stale expected angle cannot overwrite another device's change. Each rotation records before/after angle and original checksum in provenance. Page labels/order and document AI source snapshots are unchanged by presentation rotation.

Rotation is **browser presentation at rendering time**, not derivative regeneration and not a transformed download service. The shared ArchiveImage rotates one inner layer containing both image and LQIP. Quarter turns swap the displayed aspect ratio; a ResizeObserver fits the layer within fixed-size cards/stack leaves. Unrotated images need no observer. Display, responsive thumbnail and small-variant receipts/URLs remain unchanged, so there is no repeated recompression, new derivative job or original download. People/Place stack geometry uses the rotated aspect ratio. Original downloads intentionally deliver the byte-identical master, which may look sideways in an external viewer.

The existing worker already applies JPEG/PNG/WebP EXIF orientation via Sharp `autoOrient()` before generating every derivative, while libheif applies HEIF container orientation once. Manual rotation is relative to that normalized preview. Masters and master EXIF remain untouched. Existing saved photographs/documents work without re-upload. Older incorrect derivatives, if any, still require the existing explicit regeneration-from-master workflow; this release does not rewrite historical previews automatically.

Private asset delivery, authenticated ETag/304 checks, responsive sizes, lazy loading and thumbnail-only stacks/Quick Catalogue remain. Home/Explore receive counts through one paginated archive-scoped aggregate query, never a count query per card and never a download of conversation bodies. Existing item/group conversation-body retrieval is retained. No extra image HTTP request is needed for rotation metadata: it travels with existing source/current-set reads. The rotation action refreshes the shared layout so other rendered surfaces use the persisted preference.

## Manual release action

Confirm the actual production baseline through **013**, including 012 conversation. Do not infer installation from local filenames. A human then applies the complete transactional 014 file before deploying this app. Do not rerun installed migrations or split BEGIN/COMMIT. No migration, production query, push or deployment was performed by the agent.

Read-only installation markers:

```sql
select column_name from information_schema.columns
where table_schema='public' and table_name='archive_item_files'
  and column_name='presentation_rotation';
select to_regclass('public.item_conversation_counts') as counts_view,
       to_regprocedure('public.rotate_item_image(uuid,integer,integer)') as rotate_rpc;
```

Presence markers are not a complete definition/grant audit. No new secret, provider, dependency or environment variable is required. The optional AI configuration from 013 remains unchanged and disabled in local browser validation.

## Exact manual production smoke test

Use a disposable item and synthetic images.

1. On desktop and phone, open a normal photograph from Home. Family conversation should be expanded beside/below the image. Post a comment, reply, reload; verify separate attribution and no catalogue/recollection save needed.
2. Open Home and Explore. Check the count includes the reply; its link opens that item at Family conversation. Verify an empty item's Add a comment link is accessible by touch/keyboard. Archive a disposable comment as Editor; verify count excludes it after refresh.
3. From Explore heading choose Quick catalogue; from Home choose Help identify photographs. Scan the thumbnail group, choose another photograph, and use Previous/Next/Next needing information. Independently save Person, approximate date, Place and comment; reload each without a recollection.
4. On an existing sideways photograph, download the original and record SHA-256. Open Image options, Rotate right, confirm immediate success; reload and sign out/in. Verify persistence in another browser/device.
5. Rotate left; then rotate right four times, checking return to the same presentation. Try two open tabs: the stale tab must request reload rather than overwrite the newer angle.
6. Leave a quarter turn saved. Check display, thumbnail, LQIP before load, Home scrapbook, Explore, a linked Person stack and a linked Place stack. Use a portrait and panoramic example. Check mobile overflow/touch controls and retained lazy loading/private small derivatives; no full-original image fallback.
7. Download the original again and compare SHA-256 and size. Verify the original and existing derivative object paths/checksums/manifests remain unchanged; no new image set is generated by rotation.
8. Upload a synthetic JPEG with known EXIF orientation. Confirm normalized display/thumbnail/placeholder and unchanged original EXIF. Apply manual rotation and verify it is relative to the normalized display.
9. Read a multi-page letter and rotate one page only. Check page navigation/order, originals, transcription/source-language/English separation, review and processing history. Do not send real family pages to AI as part of this smoke test.
10. Check Viewer/Commenter read-only rotation, own eligible Contributor rotation, unrelated Contributor denial, Editor rotation, signed-out and cross-archive denial. Check archived/deleting items reject rotation. Confirm comment posting still follows existing roles.

See [validation](validation.md) and [exact commit manifest](conversation-rotation-commit-manifest.md). Hosted latency, actual family-image acceptance and physical Safari remain manual checks.
