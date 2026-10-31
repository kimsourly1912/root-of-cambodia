# Feature structure migration playbook

**Status:** active task procedure for [ADR 0008](../architecture/decisions/0008-feature-based-modules.md); usable only after the owner accepts that ADR. Does not grant authorization.

**Responsible role:** technical maintainer (responsibility, not an assigned person).

**Last source verification:** 31 October 2026, main [77b992a](https://github.com/kimsourly1912/root-of-cambodia/commit/77b992a71ab4ceac8d9ba08abfa6c0133cc84c8a).

**Sources:** [target structure](../architecture/feature-structure.md), [packages/backend/package.json](../../packages/backend/package.json), [vitest.backend.config.ts](../../vitest.backend.config.ts), [vitest.worker.config.ts](../../vitest.worker.config.ts), [vitest.tooling.config.ts](../../vitest.tooling.config.ts), [playwright.config.ts](../../playwright.config.ts), [tests/tsconfig.json](../../tests/tsconfig.json).

## Use when

Carrying out one stage of the feature-based reorganization. Check [ADR 0008](../architecture/decisions/0008-feature-based-modules.md) first: if its status is still "proposed", stop and ask the owner.

## Ground rules for every stage

- **Move, don't change.** No logic, SQL, API, URL, copy or test-assertion edits. Only file locations, import paths, entry files and config paths change.
- Use `git mv` for every move so history follows the file. Commit moves separately from import fixes when it keeps the diff readable.
- Start from current main with no other code PR open (moves conflict with everything). One stage per branch and PR, for example `refactor/feature-structure-1-backend`.
- Record the test count before the stage (from the latest main CI run). The stage passes only with **the same number of tests**, all passing.
- If a move would need a behavior change to compile, stop and report it instead of changing behavior.

## Stage 1: backend features

1. Create `packages/backend/src/shared/` and `git mv` errors, operations, access, schema and diagnostics into it. Add `shared/index.ts` re-exporting what other code imports today.
2. For each row of the [feature catalog](../architecture/feature-structure.md#feature-catalog), create `src/features/<feature>/` and `git mv` its files (keep file names). Move `public-listing.ts` into `features/publication/`.
3. Fix relative imports inside the backend. Within a feature: `./x`. Across features: `../<other>/index` (or `../../shared/index`), respecting the [layer table](../architecture/feature-structure.md#feature-layers).
4. Write each feature's `index.ts`: export the services, queries and types that `apps/web`, `apps/jobs` and tests use today (search `@root-of-cambodia/backend/<old-module>`). Do not export `*-persistence.ts`.
5. Replace `exports` in `packages/backend/package.json` with one entry per feature (`"./bookings": "./src/features/bookings/index.ts"`) plus `"./shared"`.
6. Update imports in `apps/web`, `apps/jobs`, `scripts/` and `tests/`. Tests that deliberately call persistence to prove bypass refusal (for example `commitRoomCalendar`, `commitPublicationAction`) keep doing so through a relative path until stage 2 co-locates them.
7. Run the checks below.

## Stage 2: tests beside features

Move with `git mv`, then fix relative imports to `packages/backend/src/testing/`.

| Current | Destination |
| --- | --- |
| support.ts, fixtures.ts, historical.ts, booking-fixtures.ts, stay-fixtures.ts, publication-fixtures.ts, listing-fixtures.ts, photo-fixtures.json | `packages/backend/src/testing/` |
| property-drafts.test.ts | `features/properties/tests/` |
| property-information.test.ts | `features/property-information/tests/` |
| property-logistics.test.ts | `features/property-logistics/tests/` |
| media.test.ts | `features/media/tests/` |
| room-types.test.ts | `features/rooms/tests/` |
| calendar.test.ts | `features/calendar/tests/` |
| publication.test.ts, publication-readiness.test.ts | `features/publication/tests/` |
| catalog.test.ts | `features/catalog/tests/` |
| listing-controls.test.ts, listing-corrections.test.ts | `features/listing-controls/tests/` |
| guest-bookings.test.ts, booking-acceptance.test.ts, stay-lifecycle.test.ts, owner-booking-filters.test.ts, deadlines.test.ts | `features/bookings/tests/` |
| external-bookings.test.ts | `features/external-bookings/tests/` |
| payment-records.test.ts | `features/payments/tests/` |
| delivery-contracts.test.ts | `features/notifications/tests/` |
| diagnostics.test.ts | `shared/tests/` |
| jobs.test.ts | `features/jobs/tests/` |
| backend.test.ts, safeguards.test.ts, boundaries.test.ts, migrations.test.ts | `packages/backend/tests/` (cross-feature) |
| worker-http.test.ts, jobs-runtime.test.ts, staging-runtime.test.ts | `tests/integration/` |
| browser/*.spec.ts, browser/server.ts | `tests/e2e/` |
| workspace.test.ts | `tests/tooling/` |

Then update:

- `vitest.backend.config.ts` include: `packages/backend/src/**/*.test.ts`, `packages/backend/tests/**/*.test.ts`; remove the root-file excludes it no longer needs.
- `vitest.worker.config.ts` include: `tests/integration/*.test.ts`.
- `vitest.tooling.config.ts` include: `tests/tooling/*.test.ts`.
- `playwright.config.ts` test directory and server path; `tests/tsconfig.json` includes.
- The `test:jobs` script path in the root `package.json`.
- [testing.md](../development/testing.md) example paths.

Check that every `*.test.ts` file is matched by exactly one Vitest project (`pnpm exec vitest list` per project) and the total equals the pre-stage count.

## Stage 3: web features

1. `git mv` the shared adapters in `apps/web/src/` (http, owner-session, guest-session, public-http, runtime, runtime-policy, return-path, staging-accounts) to `apps/web/server/`; the session and http adapters import the last two, and `server/` must not import a feature. Move feature-specific adapters with their feature: media-http and media-runtime to `features/media/`, reviewer-read to `features/publication/`.
2. `git mv` each component in `apps/web/components/` to its feature (catalog table). Keep `ui/` and `sign-out.tsx` shared.
3. Add `index.ts` (client-safe exports) and `server.ts` (server-only exports) per feature. Cross-feature uses go through them: `PropertyNavigation` from `@/features/properties`, `PublicStayDetails` from `@/features/catalog`.
4. Where a `page.tsx` contains more than param parsing, guard, read and render, extract the markup unchanged into `features/<f>/screens/<name>-screen.tsx`. Do not change markup, copy or behavior.
5. Update every `@/src/...` and `@/components/...` import.

## Stage 4: enforcement

Extend [tests/workspace.test.ts](../../tests/workspace.test.ts) (now in `tests/tooling/`) with the [enforcement rules](../architecture/feature-structure.md#enforcement). Prove each rule by temporarily adding a violating import locally, seeing the test fail, and removing it. Do not commit the violation.

## Stage 5: docs

Update the [overview module map](../architecture/overview.md#module-map) to folder paths, the source links in `docs/features/*`, the `feature-structure.md` status (applied), ADR 0008 status (accepted and implemented), [AGENTS.md](../../AGENTS.md) layout lines and [status](../status.md). Run `node scripts/check-doc-links.ts`.

## Checks for stages 1–4

~~~sh
pnpm install --frozen-lockfile
pnpm types:bindings
pnpm typecheck
pnpm build:worker && pnpm build:jobs
pnpm test                 # same count as before the stage
pnpm test:browser         # or rely on PR CI if local Chromium is unavailable
git diff -M --stat origin/main   # moves should show as renames (R), not delete + add
~~~

## Pitfalls to expect

- A barrel `index.ts` that re-exports a `"use client"` component together with server code breaks the Next.js build or leaks server code. Keep `index.ts` and `server.ts` separate.
- Workers tests resolve migrations through `apps/web/wrangler.jsonc`; moving tests does not change that path.
- `apps/web/tsconfig.json` uses `@/*` for the app root; `@/features/...` and `@/server/...` work without config changes.
- Windows checkouts convert line endings; review renames with `git diff -M` so a CRLF change does not hide a real edit.
