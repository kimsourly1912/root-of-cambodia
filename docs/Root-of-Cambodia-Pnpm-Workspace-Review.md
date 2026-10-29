# Root of Cambodia — pnpm Workspace Review

Date: 28 October 2026
Scope: the owner explicitly requested pnpm instead of npm before the next product implementation. PR #9 was confirmed merged; baseline main is 812965e1a62774a6f0d7075e43dbd39f226ccf14. This decision supersedes the earlier npm tooling choice, while retaining the approved application layout and stack.

## Implemented setup

- Pin pnpm 12.15.0 in packageManager; keep Node 24.22.1 and every existing application/tool dependency version.
- Define exactly apps/web, apps/jobs and packages/backend in pnpm-workspace.yaml. Both apps use workspace:* for the private backend, preventing accidental registry fallback.
- Replace the active root npm lockfile with pnpm-lock.yaml and convert root commands to pnpm filters/recursive scripts. The historical proof stays independent and unchanged, outside the active workspace.
- Use pnpm's isolated installation layout. No hoisted-layout workaround, new task orchestrator, framework or test runner was introduced.

Use pnpm 12.15.0 on PATH, or a Corepack installation that follows packageManager. An older global pnpm is not evidence that the pinned manager was used. Validation below used the exact pinned version for the root command and its child scripts.

```sh
pnpm --version
pnpm install --frozen-lockfile
pnpm run init:local
pnpm run types:bindings
pnpm run typecheck
pnpm run build:worker
pnpm run build:jobs
pnpm test
```

OpenNext chooses its package manager from lockfiles. Removing the active package-lock.json is necessary so the adapter itself invokes pnpm for the Next.js build, rather than only wrapping an npm build with a pnpm root command.

## Dependency and installation policy

Root tests now explicitly declare their existing backend and Better Auth imports instead of relying on npm hoisting. These are workspace links/the same pinned library, not new package versions.

The npm lock had 506 package entries representing 493 distinct package-name/version/integrity combinations after normalizing aliases and duplicate locations. The final pnpm application resolution contains the same 493 combinations. pnpm's additional package-manager lock document pins its own platform executables; that is part of installing the requested manager, not an application framework upgrade.

The initial import selected older @dotenvx/primitives and baseline-browser-mapping versions because of release-age filtering. Narrow overrides retain the original @dotenvx/providers@0.3.12 → @dotenvx/primitives@4.1.0 resolution and baseline-browser-mapping@2.11.34. The separate original primitives@3.3.1 resolution is retained, not globally upgraded.

Release-age checks remain enabled and strict. Five exact-version exclusions preserve already-locked packages: the existing Vitest plugin, Wrangler, Miniflare and the two retained transitive versions above. No global cooldown or lifecycle-script protection was disabled. Only the existing esbuild/workerd build scripts are allowed; optional fsevents scripts are denied. Both required native tools were installed/built successfully.

Regenerating Worker bindings after an existing build exposed an earlier test-typecheck issue: generated environment declarations can reference the generated JavaScript Worker bundle. The only handwritten JavaScript helper checked by the test project was migrated to typed handoff-local.ts, loaded directly by pinned Node 24. Tests now check TypeScript sources without checking generated OpenNext JavaScript as application source. Existing handoff/data-preservation assertions remain and pass; strict TypeScript settings were not reduced.

## Local verification

Linux, Node 24.22.1, pnpm 12.15.0 and the existing pinned dependency set.

| Check | Result |
| --- | --- |
| Lock import/artifact audit | All 493 original distinct application package versions/integrities retained |
| Fresh isolated installation | Passed after removing only generated node_modules directories; frozen lockfile accepted |
| Local initialization and regenerated bindings | Passed; retained migration tracking and local state preserved |
| Separate web/jobs/backend/test typechecks | Passed |
| Next.js/OpenNext build | Passed; adapter invokes pnpm |
| Local jobs build | Passed using Wrangler dry-run only |
| Combined Vitest suite | All 77 tests across eleven files passed, including both built-Worker journeys and the 12 original HTTP checks |
| Scope | Business services, applied migrations, runtime configuration and historical proof unchanged |

These are local results. Windows, remote integrations, inbox delivery, load and recovery are not newly verified. The existing OpenNext dependency audit finding remains. No deployment, infrastructure provisioning or pull-request merge was performed.

The pnpm migration is kept separate from step 6 product features. Owner account screens and private property draft setup follow in a separate reviewable change. Arrival and other unresolved product policies remain open.

References: [pnpm workspaces](https://pnpm.io/workspaces), [lock import](https://pnpm.io/cli/import), [installation](https://pnpm.io/installation) and [script approvals](https://pnpm.io/cli/approve-builds). Lock import is a fresh resolution with preferred source versions; the explicit artifact comparison above is what establishes version preservation here.
