# Testing baseline

GitHub issue #50 establishes the minimum merge gate for every vertical slice.

## Public seams

- **Unit:** exported deterministic domain/security contracts in `src/lib`, tested with
  independent known-good values rather than internal mocks.
- **Authenticated HTTP and browser:** real Next.js routes and user-visible flows through
  Chromium, backed by a fresh isolated SQLite database.
- **Database migration:** the checked-in Prisma migration chain must create the isolated E2E
  database from nothing before the browser server starts.

Async Server Components and complete user flows belong in E2E tests. Component snapshots and
tests that mock internal Prisma/store calls are not part of the baseline.

## Commands

| Command | Gate |
| --- | --- |
| `npm run typecheck` | TypeScript without incremental cache |
| `npm run lint` | ESLint/Next rules |
| `npm run test:unit` | Vitest unit contracts |
| `npm run test:e2e` | Chromium browser flow with isolated `prisma/e2e.db` |
| `npm run build` | Production Next build |
| `npm run test:ci` | All gates in local CI order |

The E2E setup deletes only the ignored `prisma/e2e.db` test artifact, deploys the committed
migrations, starts Next on port 3100 with that database, and removes the artifact after the
run. It never opens, copies, migrates, or deletes `prisma/dev.db` or its backups.

## CI policy

`.github/workflows/ci.yml` runs on pull requests and pushes to `main` or `recovery/**` using
the repository Node version and one Chromium worker. A change is mergeable only when
Prisma validation/generation, typecheck, lint, unit tests,
browser E2E, and build all pass. Playwright diagnostics are retained for 14 days.

Each feature ticket must add the smallest test at its public seam. Bug fixes first add a
reproducing failure. LiveKit multi-user media behavior remains in its dedicated E2E ticket;
this baseline requires no LiveKit or Supabase secret.

## Primary references

- [Next.js testing guide](https://nextjs.org/docs/app/guides/testing)
- [Playwright web-server configuration](https://playwright.dev/docs/test-webserver)
- [Playwright CI guidance](https://playwright.dev/docs/ci)
- [Vitest guide](https://vitest.dev/guide/)
