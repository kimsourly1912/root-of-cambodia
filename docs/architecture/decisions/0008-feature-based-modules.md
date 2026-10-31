# ADR 0008: Feature-based code organization

**Status:** accepted, 31 October 2026; migration in progress (see [approval record](#approval-record)).

**Responsible role:** project owner (acceptance); technical maintainer (implementation).

**Last source verification:** 31 October 2026, main [77b992a](https://github.com/kimsourly1912/root-of-cambodia/commit/77b992a71ab4ceac8d9ba08abfa6c0133cc84c8a).

**Sources:** [target structure](../feature-structure.md), [architecture overview](../overview.md), [ADR 0001](0001-modular-monolith.md), [packages/backend/package.json](../../../packages/backend/package.json), [tests/workspace.test.ts](../../../tests/workspace.test.ts).

## Context

The modular monolith ([ADR 0001](0001-modular-monolith.md)) is organized by **file kind**, not by business area:

- `packages/backend/src/` holds 52 flat files. One feature is spread over three to six of them (`room-types.ts`, `room-queries.ts`, `room-persistence.ts`), told apart only by name prefix. `package.json` exports all 52 modules, persistence included, so any app or test can bypass a service.
- `apps/web/components/` holds 27 feature-specific components next to each other, with no sign of which feature owns them. `apps/web/src/` mixes shared server adapters (`http.ts`, used by 32 files) with feature-specific ones (`media-http.ts`, `reviewer-read.ts`).
- `tests/` holds 29 test files and 8 fixture/support files flat, plus browser specs. A feature's tests are found by guessing names.
- Boundaries are documented but only partly enforced: the [overview](../overview.md#dependency-direction-and-module-rules) says export surfaces are wider than intended and the regex boundary test covers only part of the dependency direction.
- One type-only cycle exists: `public-listing` imports a type from `publication-queries`, which imports `public-listing`.

As features grow (exceptional stays, admin/support, notifications), the flat layout makes it harder for people and agents to find everything about one feature, keep private code private, and review a change's blast radius.

The owner has used a feature-based layout successfully in another project (nuk-cafe admin, Nuxt) and asked for the same approach here.

## Decision (proposed)

Adopt the layout in [feature-structure.md](../feature-structure.md):

1. **Backend:** `packages/backend/src/features/<feature>/` with an `index.ts` public API, the existing service/queries/persistence files, and co-located `tests/`. A `shared/` kernel (errors, operations, access, schema, diagnostics) imports no feature. Package `exports` shrink to one entry per feature plus `shared`; persistence is no longer exported.
2. **Web:** `apps/web/features/<feature>/` with client-safe `index.ts`, server-only `server.ts`, `screens/`, `components/`, `hooks/`, `lib/`, `tests/`. `app/` keeps only thin routes. Shared UI stays in `components/` (`ui/` primitives and shell), shared server adapters move from `src/` to `server/`.
3. **Tests:** feature tests move into their feature's `tests/`; cross-feature backend tests go to `packages/backend/tests/`; whole-app tests are grouped in `tests/integration`, `tests/e2e` and `tests/tooling`.
4. **Dependencies:** features form the one-way [layer graph](../feature-structure.md#feature-layers). `public-listing` joins `publication`, removing the cycle.
5. **Unchanged:** runtime behavior, APIs, URLs, SQL migrations (one ordered directory), the atomic-operation and privacy rules, the modular monolith, the toolchain and dependencies.

## Alternatives considered

| Option | Benefit | Cost / risk |
| --- | --- | --- |
| **A. Keep the flat layout** and only document ownership | No churn | Problems above remain and grow; export surface stays wide |
| **B. Feature folders, backend only** | Smaller first step; fixes the export surface | Web and tests stay hard to navigate; two conventions coexist longer |
| **C. Full feature layout, staged (recommended)** | One consistent rule across backend, web and tests; narrow public APIs; enforceable | Large mechanical moves; open branches need rebasing; one-time learning |
| **D. Separate pnpm package per feature** | Strongest isolation | Many manifests and build entries for a small team; contradicts the "one shared library" choice in ADR 0001 |
| **E. Add ESLint with boundary plugins** | Editor feedback, mature rules | New dependencies and config; can be added later on top of C |

## Consequences

- **Positive:** one place per feature; private persistence cannot be imported from outside; feature tests next to code; easier, smaller-context agent tasks; enforceable boundaries.
- **Negative:** every import path changes once; `git log` needs `--follow` for moved files (moves use `git mv` so history is kept); large PRs to review; open feature branches must rebase.
- **Neutral:** test counts and CI steps stay the same. Each stage must pass the same suite with the same number of tests.

## Migration plan

Run one stage per PR, when no other code PR is open, following the [migration playbook](../../playbooks/feature-structure-migration.md). Each stage is a pure move with no behavior change.

| Stage | Scope | Done when |
| --- | --- | --- |
| 1 | Backend: create `shared/` and `features/`, `git mv` files, add `index.ts` per feature, narrow `exports`, update imports in web, jobs and tests | Typecheck, both builds, full Vitest and browser CI pass with the same test count |
| 2 | Tests: move feature tests and fixtures beside their feature; group root tests; update Vitest include paths | Same suite, same count, every test file is matched by exactly one project |
| 3 | Web: create `features/`, `server/`; move components and adapters; thin routes render screens | Same build, browser journeys unchanged |
| 4 | Enforcement: extend the tooling boundary test with the rules in [feature-structure](../feature-structure.md#enforcement) | Test fails on a deliberate violation and passes on main |
| 5 | Docs: update the overview module map, feature contracts' source links, this ADR to accepted-and-implemented, and status | Link checker passes; no doc points at old paths |

Rollback for any stage is reverting its PR; no data, schema or deployment is involved.

## Approval question

Do you accept option C, the full feature-based layout, implemented in the five stages above (one PR each, behavior unchanged)? Acceptance authorizes the code moves and checks for these stages only. It does not authorize merging, deployment or any behavior change.

## Approval record

On 31 October 2026, after reviewing this proposal and the [target structure](../feature-structure.md), the project owner replied "alright now help me organize the project to this new architecture". This accepts option C and authorizes the behavior-neutral moves and local checks for stages 1–5. It does not authorize merging, deployment, remote migrations or behavior changes.
