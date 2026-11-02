# Home voice memories and navigation feedback

Home cards now offer Record a message to Contributors and above, using the existing private audio capture/upload flow with the current photo supplied as its item. Saving stays on Home and refreshes the available recordings. Closing an open recorder asks before discarding unsaved work.

The inline form brings speaker names and multiple linked People forward, with other details optional. Speaker text can name a joint conversation (for example Jan and Craig); People links describe associations and are not inferred speaker identities. Existing audio originals, permissions and signed playback are unchanged.

A Listen badge on the photo displays the recording count. Opening it shows separate named memories; recordings are not merged and do not autoplay. Playing another recording in that photo's panel pauses the previous one. Archived recordings are excluded. Audio loading failures are visible and do not hide photographs. Home's loaded workspace supplies the People picker.

Header links now have hover, pressed and keyboard-focus feedback plus a spinner inside the pending link, using the installed Next.js useLinkStatus API. Pending feedback clears when navigation completes. Reduced motion disables spinner rotation.

Validation: production build, lint, TypeScript and whitespace checks; 122 general regressions passed before the final Home workspace wiring correction. Six focused authenticated checks passed on the final build, covering Home capture controls, multiple People selection, local preview, named private playback, mutually exclusive playback and delayed desktop navigation, plus existing source/People/Places flows. Additional existing authenticated scenarios passed during development; interrupted broad runs are not claimed as complete passes.

Screenshots use synthetic fixtures: /private/tmp/home-voice-memory-375.png and /private/tmp/home-listen-memories-375.png. Physical iPhone Safari recording and a real account's upload remain manual acceptance checks. No migration or dependency was added; generated next-env.d.ts is excluded.

## Live acceptance

1. As a Contributor, open Home and tap Record a message under a photo.
2. Tap Record and allow microphone access. Speak, pause/resume if needed, then Stop.
3. Preview it, enter Jan as the speaker and optionally select one or more People.
4. Save; remain on Home. Refresh and open the photo's Listen badge.
5. Add a second memory and confirm both names appear independently; playing the second pauses the first.
6. Open the full photo and verify the same recording is available there.
7. On desktop, hover a navigation link and click it; slower transitions show a spinner in that link.
