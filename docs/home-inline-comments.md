# Home inline comments

Home gallery cards now reuse the existing Explore inline conversation component instead of linking Add a comment to the detail page. Clicking the comment control immediately opens a loading state, then the existing conversation and composer beneath that photograph. The image and title retain their detail-page links.

This uses the existing authenticated conversation endpoint, workspace-scoped cache and write actions. Threads load only on demand; posting updates the visible conversation and count without refreshing Home. Closing and reopening preserves an unsent draft while the component remains mounted. Existing role checks, errors/retry, replies and own-comment editing remain in the shared implementation. No schema, dependency or permissions change is required.

The Home browser regression checks opening without navigation, one scoped lazy request, posting and persistence after reload, composer focus, preserved horizontal position, draft retention and a reduced-height mobile viewport. Physical Safari keyboard behaviour still needs live acceptance.

Validation: lint, TypeScript, production build and whitespace checks passed. The authenticated suite passed 19 scenarios initially, including the expanded Home test and all eight screen widths. The remaining scenario expected the former comment link; after updating it to expect the inline button, that scenario and its four fixture-setup scenarios passed on a targeted rerun. Logs: `/private/tmp/archive-home-comments-validation.log` and `/private/tmp/archive-home-comments-recheck.log`. The reduced-height composer screenshot was visually reviewed. No production data was used for testing.
