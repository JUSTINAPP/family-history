# Full-screen photo memories

Home photo clicks, Listen badges and Record a message now open one full-viewport native modal dialog. The title link still opens item details, also available inside the viewer. The modal locks background scrolling, contains keyboard focus, restores the trigger on closing and stops playback when dismissed. Unsaved recordings or entered context prompt before closing or changing mode; saving disables dismissal.

Listening attempts playback immediately following the user's action. Browser autoplay restrictions fall back to an explicit Play control. Loading and buffering show a spinner and status text; errors offer Retry audio. Play/pause, seek, elapsed time and duration use consistent rounded controls. Multiple memories remain separate, selected by speaker name, with only the selected audio mounted. Larger authenticated image derivatives are requested only when the viewer opens.

The photo gently zooms and pans while audio is playing. Motion pauses with playback, has an explicit Keep photo still control, and is disabled by prefers-reduced-motion. Image loading and failure states are separate from audio states. Recording lives beside the photo on desktop and beneath a smaller photo on mobile, within the same viewer. Capture/import buttons and input fields now share 8px corners; voice panels use 12px corners.

No database migration, dependency, account change or audio transformation is involved. Private audio delivery, originals and existing save/link permissions are retained.

Validation: production build, lint, TypeScript, whitespace checks, 122 general regressions and six focused authenticated browser scenarios passed. Focused coverage includes recording fields and preview, unsaved close confirmation, delayed audio loading feedback, speaker switching, pause/motion synchronisation, reduced motion, Escape/focus restoration, full-screen photo opening and existing source/People/Places/navigation checks. Screenshots inspected at 375px and 1440px, using synthetic data.

Manual acceptance still required on physical iPhone Safari: open Listen, confirm playback or tap Play if prompted, seek/pause/resume, close and check silence; open Record, allow microphone, record/preview/name/link/save and verify the stored memory. Browser permission and autoplay behaviour cannot be guaranteed from desktop Chromium tests.
