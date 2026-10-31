# Demo walkthrough

Use the development server's printed Local URL. All flows are local mock state and reset on reload. Follow links within the app to keep the session alive.

## A photograph and a voice

1. Add to archive → Upload existing (or Take photo on a phone).
2. See the original preview → Tell us → Record → Pause → Continue → Finish recording.
3. Play recording. The voice is a labelled example, not your microphone.
4. Make a transcript → Edit transcript. Raw machine words and audio stay separate.
5. Find a few details in my words → Confirm, Correct or Remove an example suggestion. Ignore for now is also fine.
6. Save & view. Replay/download original example audio, inspect raw vs edited text and download your selected original image or metadata manifest.
7. Capture the next item. The counter tracks this session; earlier captures remain under Admin → Processing.

## A box of photographs

Enable Rapid capture before choosing a photograph. Add a short recollection or no context at all, then Save & next. The camera is invoked from that gesture where the browser supports it. A desktop may open a file chooser instead; Take photo remains available. Do not wait for processing. Bulk upload remains available for folders and batches; Save & next creates items in the same session queue.

## A letter

Start a letter → Photograph page 1 or upload multiple pages → add another page → select envelope front/back roles → use arrow controls to reorder → voice/text context (optional Written by, Sent to, When, Where) → Save & view or Save & next. Processing runs independently.

A saved letter has an adjacent source/transcription review preview. Correct transcription → save reviewed text → switch back to Raw AI transcription to see it unchanged. The preview words are fictional, not an actual reading of uploaded material. You can also open the representative letter's comparison review from its transcription section or Admin → Processing → Review transcription.

## Invite a family member

Profile → Archive administration → Members → Invite member. Enter a name and email, optionally link to the same historical Person, choose a role and Send invitation. No email is sent. Invitations → Try acceptance simulates redemption and adds a membership. Revoked/expired examples and invitation renewal are available. Existing emails and pending invitations are checked in the demo.

Members → Manage allows role/person linkage, suspension, restoration and removal. Contributions and provenance remain. The archive owner cannot be demoted or lose access until ownership is transferred; at least one active Admin remains. Sarah's account is linked to the living Sarah Person example. Ancestors have no member account.

## Try permissions and settings

Admin's Preview access as selector demonstrates the archive-scoped role gates. Viewer sees a clear access message in administration and capture; Editor can inspect processing/review but cannot manage members; Admin can manage invitations and settings. This selector is for UX evaluation only, never a real permission authority.

Archive settings can change the archive's name/cover/description in the admin shell, default invited role, invitation policy and conceptual processing preferences. Privacy can be Invited members only or Only the owner, represented rather than enforced. Ownership can transfer to another active Admin. Export entire archive downloads a **metadata-only concept**, not an image/audio backup.

## Name and shape the archive

Open the current name in the header: The Allen & Cork Archive. The small switcher lists this archive and its role, with home/settings links; this demo creates no extra archives. In Archive settings, edit the name/description, choose a cover, preview private access and choose default permissions for new invitations. Rename updates the header and admin context; UUID and created date remain stable and the slug only changes if explicitly edited. Manage archive members opens the existing member/role tools. All changes remain session-only; Supabase is still unconnected.
