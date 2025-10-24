# Repository Guidelines

## Project Structure & Module Organization
Route code lives in `src/app`, with each segment co-locating pages, layouts, and server actions. Shared UI stays in `src/components`, utilities in `src/lib`, and server-only email or PDF logic in `src/server`. Static assets belong in `public/`. Prisma schema, migrations, and seeds sit under `prisma/`, while domain tests live in `tests/`.

## Build, Test, and Development Commands
Run `npm run dev` for the hot-reloading server. Build with `npm run build` and serve with `npm start`. `npm run lint` enforces the Next.js ESLint profile, and `npm test` runs Vitest. After schema edits run `npm run prisma:generate`, create migrations with `npm run prisma:migrate`, deploy via `npm run prisma:deploy`, and reseed using `npm run db:seed`.

## Coding Style & Naming Conventions
Write TypeScript in `.ts`/`.tsx` files and rely on ESLint to enforce React hooks, accessibility, and import order. Use PascalCase component files (`InvoiceList.tsx`), camelCase hooks and helpers, and keep route-specific logic beside its segment in `src/app`. Indent with two spaces, prefer trailing commas, and expose shared utilities via named exports. Keep sensitive logic in `src/server` modules to avoid shipping secrets.

## Testing Guidelines
Vitest handles unit and integration checks. Add specs under `tests/` using `*.test.ts` names that mirror the subject (`quote-invoice.test.ts`). Favor deterministic assertions for PDF rendering, emailing, and Prisma math; stub external I/O to keep runs fast. Run `npm test` before every push and `npx vitest --run --coverage` when gauging impact. Seed records with `npm run db:seed` whenever tests rely on known data.

## Commit & Pull Request Guidelines
Write small, imperative commits (`fix: align invoice totals`) and avoid mixing schema work with UI tweaks; add context in the body when helpful. Pull requests must state what changed, why, and how to verify, link issues, and attach screenshots or PDFs for document updates. Highlight migrations or env additions under “Deployment Notes,” and ensure `npm run lint`, `npm test`, and `npm run build` pass before requesting review.

## Environment & Security
Copy `.env.example` to `.env` for local work, adjusting `DATABASE_URL` and SMTP settings per environment. The checked-in SQLite database at `prisma/prisma/dev.db` is fine for local testing only. Rotate `SESSION_COOKIE_SECRET` and mail credentials regularly and never commit them. After every `schema.prisma` change, regenerate the client with `npm run prisma:generate` to prevent runtime mismatches.
