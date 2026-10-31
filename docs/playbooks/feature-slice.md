# Feature slice playbook

**Status:** active task procedure; does not grant authorization.

**Responsible role:** maintainer (responsibility, not an assigned person).

**Last source verification:** 31 October 2026, main [40f7ffa](https://github.com/kimsourly1912/root-of-cambodia/commit/40f7ffa553a14005f622aa5c846f0f9dc5e70f42).

**Sources:** [architecture overview](../architecture/overview.md), [database contract](../architecture/database.md), [testing](../development/testing.md), [listing-controls.ts](../../packages/backend/src/features/listing-controls/listing-controls.ts), [listing-controls.tsx](../../apps/web/features/listing-controls/components/listing-controls.tsx).

## Use when

Implementing behavior that [scope](../product/scope.md) or an accepted proposal already allows. If a rule is missing or ambiguous, stop and use the [decision proposal](decision-proposal.md) playbook.

## Inputs to confirm first

- The accepted rule and its approval record (scope, proposal or ADR).
- Authorized actions for this task: local `pnpm init:local` and checks are normally included in a code task; merge, deploy and remote migrations are not unless stated.
- The closest existing feature to copy. Recent complete examples: listing controls (#33), owner booking filters (#31), payment records (#28).

## Steps

1. Branch `feat/<topic>` from current main.
2. Find the feature folder in the [feature catalog](../architecture/feature-structure.md#feature-catalog): `packages/backend/src/features/<feature>/` holds `<name>.ts` (validation, permissions, rules), `<name>-queries.ts` (scoped reads) and `<name>-persistence.ts` (one named atomic save). Add to these or create a matching trio, export new services from the feature's `index.ts` (never persistence), and follow [adding a new feature](../architecture/feature-structure.md#adding-a-new-feature) for a new area. Do not add generic repositories or new frameworks.
3. Writes: the operation receipt, state change, history event and outbox row commit in one D1 batch. Recheck verified identity and ownership inside that batch (triggers or guarded statements), not only before it.
4. Retries: clients send an operation key. Same key and same body returns the original receipt; same key with a different body is a conflict. After an uncertain response, the UI retries with the identical key and body. It never creates a new attempt automatically.
5. Routes in `apps/web/app/api/...` stay thin: session, Origin/JSON checks, body-size cap, call the service, map errors. New error codes must be registered in [errors.ts](../../packages/backend/src/shared/errors.ts).
6. Private responses use no-store. Never log guest data, tokens or raw provider errors.
7. UI: disable interactive controls until hydration completes (see the `hydrated` state in [listing-controls.tsx](../../apps/web/features/listing-controls/components/listing-controls.tsx)). Cover stale tabs, uncertain retry and phone width.
8. Schema changes: follow [schema migration](schema-migration.md).
9. Tests, as applicable from the [testing matrix](../development/testing.md#select-meaningful-checks):
   - native backend: `packages/backend/src/features/<feature>/tests/*.test.ts` covering permissions, races, replay, rollback and commit-time revocation (shared fixtures in `packages/backend/src/testing/`);
   - built Worker: extend [worker-http.test.ts](../../tests/integration/worker-http.test.ts) for new routes;
   - browser: extend the journey in [tests/e2e](../../tests/e2e/) for desktop and phone.
   - UI components go in `apps/web/features/<feature>/components/`; routes import them directly.
10. Update the feature contract in `docs/features/`, the [feature catalog](../architecture/feature-structure.md#feature-catalog) and [module map](../architecture/overview.md#module-map) if files were added, and [status](../status.md). `pnpm exec vitest run --project tooling` checks the import rules.
11. Finish with [PR and handoff](pr-and-handoff.md).

## Local checks

~~~sh
pnpm install --frozen-lockfile
pnpm init:local && pnpm types:bindings   # writes local state; only if authorized
pnpm typecheck
pnpm exec vitest run --project backend packages/backend/src/features/<feature>/tests
pnpm exec vitest run --project tooling   # feature boundary rules
pnpm build:worker && pnpm build:jobs     # both required before the full suite
pnpm test
pnpm test:browser                        # needs matching Chromium; CI is the fallback
~~~

## Done when

- The accepted rule is enforced at commit time, not only in the UI.
- Existing tests still pass unchanged, unless an assertion was provably wrong (explain it in the PR).
- Contract, module map and status describe what was actually built.

## Pitfalls seen in this repository

- Server-rendered controls submitted before React attached handlers (#28 publication, #34 stay completion). Fix: gate on hydration, and add a browser case that holds scripts back.
- New fixtures changed totals in older tests, such as booking counts in the Worker journey (#30). Update the expected number with a before+1 style assertion; do not remove the check.
- An unregistered error code fails the type check (#30). Register it in the existing allowlist.
