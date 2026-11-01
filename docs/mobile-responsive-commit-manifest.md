# Mobile responsive audit — proposed commit contents

Base: `82ddc7c` (`Improve letter reading correspondence and page performance`). This is a review manifest only; nothing has been staged, committed, pushed or deployed.

## Exact files

| File | Purpose |
| --- | --- |
| `README.md` | Link to the mobile audit and release checks. |
| `docs/validation.md` | Validation results and restart recovery evidence. |
| `docs/mobile-responsive-audit.md` | Findings, measurements, route coverage, limitations and physical iPhone smoke test. |
| `docs/mobile-responsive-commit-manifest.md` | This explicit commit scope. |
| `src/app/globals.css` | Mobile typography, header, paper geometry, grids, forms, conversation and touch targets. |
| `src/app/stories/[slug]/page.tsx` | Responsive related-material grid and readable disclaimer. |
| `src/components/archive-image.tsx` | Honor caller image sizes on the fallback Image path. |
| `src/components/explore.tsx` | Match responsive image sizes to the mobile gallery layout. |
| `src/components/header.tsx` | Menu/profile dismissal, focus restoration and bounded mobile navigation prefetch. |
| `src/components/live/live-item.tsx` | Place item metadata before Family Conversation consistently. |
| `tests/archive.spec.ts` | Add 360, 390 and 430px to the existing route sweep. |
| `tests/preview-pipeline-browser.spec.ts` | Authenticated five-width mobile checks, expanded controls, type/touch assertions, accessibility and Retina/desktop checks. |

## Exclusions and release scope

Exclude generated `next-env.d.ts`, all `.next*` output, test results, temporary logs/screenshots, local environment files and secrets. The generated `next-env.d.ts` change is intentionally left unstaged; do not include it when selecting the files above.

No database migration is required. No SQL, backend authorization/storage/provider primitive, dependency or environment configuration changes belong to this release. Migrations 001–016 remain unchanged. No production action was performed.

See [validation](validation.md) and the [audit and exact production iPhone smoke test](mobile-responsive-audit.md). Physical iPhone Safari acceptance remains pending until an approved application deployment.
