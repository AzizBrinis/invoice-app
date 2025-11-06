# Build Fix Report

- Build command: `npm run build`
- Working directory: `/Users/brinis/Documents/Learning/ai/codex/invoices-app`
- Run context: network access restricted (Google Fonts fetch blocked)

## Build-blocking issues

1. File: `next/internal/font/google/geist_deef94d5.module.css`, line: n/a (generated)
   - Error: `next/font: error: Failed to fetch 'Geist' from Google Fonts.`
   - Context: Turbopack attempts to download the Geist family CSS from `https://fonts.googleapis.com/css2?family=Geist:wght@100..900&display=swap`, but the network request fails under the current sandbox.

2. File: `next/internal/font/google/geist_mono_1bf8cbf6.module.css`, line: n/a (generated)
   - Error: `next/font: error: Failed to fetch 'Geist Mono' from Google Fonts.`
   - Context: Same as above for the Geist Mono family (`https://fonts.googleapis.com/css2?family=Geist+Mono:wght@100..900&display=swap`).

## Actionable remediation tasks

1. Allow the build to reach Google Fonts (temporary fix)
   - Re-run the build with network access enabled so Turbopack can fetch the remote stylesheets.
   - Confirm the build succeeds and no additional font errors remain.

2. Long-term hardening (prevents future offline failures)
   - Replace the remote `next/font/google` usage with `next/font/local` and commit the Geist font files to the repo (or to a CDN the build can reach).
   - Update the relevant imports (likely under `src/app/...`) to use the local font configuration.
   - Re-run `npm run build` to verify the fonts compile without network access.

## Additional warnings noted

- `next.config.ts`: Replace deprecated `experimental.typedRoutes` with the stable `typedRoutes` flag to avoid future config errors.
