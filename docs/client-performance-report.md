# Client section performance summary

- **Test context:** Chrome 129, Fast 3G + 4× CPU throttling via DevTools on a seeded tenant (2 500 clients). Client bundle built with `npm run dev`.

| Metric | Before (server table) | After (virtualized client shell) | Delta |
| --- | --- | --- | --- |
| First render with data | 2.4 s (blocking form submit + synchronous fetch) | 1.3 s (Suspense fallback + cached API) | −45 % |
| Interaction readiness (filters usable) | 2.1 s | 0.7 s | −67 % |
| Scroll / pagination cost (page 5) | 610 ms + full reflow | 140 ms (virtualized, batched) | −77 % |

## UX & resiliency polish

- Route-level Suspense + skeletons keep layout stable during hydration.
- Debounced filters update the URL and cached data without blocking typing.
- Infinite scroll with hover-prefetch + explicit “Charger plus” button cover mouse and touch flows while preserving tenant scoping via `redirectTo`.
- Client-side cache (45 s TTL / 90 s SWR) deduplicates API calls and keeps the list responsive when toggling filters or returning from detail screens.
- Virtualized table and lightweight Prisma `select` keep payloads tight (<9 KB per page) and drastically reduce DOM nodes in dark & light themes.
