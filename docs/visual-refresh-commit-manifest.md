# Visual refresh — exact proposed commit manifest

Base: `501bf4c`. No files have been staged or committed by this task. Select only these files for the proposed application commit:

```text
README.md
docs/validation.md
docs/visual-refresh.md
docs/visual-refresh-commit-manifest.md
src/app/about/page.tsx
src/app/globals.css
src/app/layout.tsx
src/app/page.tsx
src/app/places/page.tsx
src/app/sign-in/page.tsx
src/components/archive-switcher.tsx
src/components/explore.tsx
src/components/header.tsx
src/components/live/live-home.tsx
src/components/live/live-item.tsx
src/components/live/places-overview.tsx
src/components/live/session-layout.tsx
src/components/people-overview.tsx
src/lib/home-material.ts
src/lib/home-visit.ts
src/proxy.ts
tests/archive-architecture.spec.ts
tests/archive.spec.ts
tests/catalogue-scrapbook.spec.ts
tests/live-auth.spec.ts
tests/preview-pipeline-browser.spec.ts
tests/visibility-browser.spec.ts
```

The application files implement the refreshed typography, identity/navigation, real-material Home, neutral introductions and server-rendered visit seed. Tests retain existing workflows and image/permission assertions, adjust changed labels and feature counts, and add seed stability and the expanded responsive matrix. The People material-pile component is unchanged.

Exclude generated `next-env.d.ts` (already modified before this task), `.next*`, test results, local environment/secrets, temporary harnesses, logs and screenshots. QA screenshots are provided separately under `/private/tmp/allen-cork-visual-refresh/`; they contain synthetic records and a public codec fixture, not production material. No reference-preview sample images were copied into the application.

No migration, dependency, package-lock or environment configuration change is required. No SQL or storage/provider implementation belongs in this commit. Do not rerun migrations 001–016 for this release.

[Implementation, limitations and production smoke test](visual-refresh.md) · [validation](validation.md).
