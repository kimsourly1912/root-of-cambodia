> **Historical snapshot — not current instructions.** Archived 29 October 2026 from [docs/Root-of-Cambodia-Vitest-Alignment.md at 607a705](https://github.com/kimsourly1912/root-of-cambodia/blob/607a7057b908a005f9f3529141b0978f52d24ce0/docs/Root-of-Cambodia-Vitest-Alignment.md). Original dates, decisions, PR states and results below are historical.
> **Current authority:** [docs/development/testing.md](../../development/testing.md), [docs/status.md](../../status.md).
> Historical text is preserved; relative link destinations are adjusted only for relocation. Do not execute old setup or prototype prompts as current guidance.

<!-- historical-body-start -->

# Root of Cambodia — Vitest Alignment

Date: 28 October 2026
Baseline: main at a7f85b92653ce83c7a1a1c862f26b7fed299e437, after merged PR #4.
Status: Implementation-plan step 1 completed and verified locally; no deployment.

## What changed, in plain language

The application tests now use Vitest as agreed. The same booking scenarios remain, but the database service tests execute inside Cloudflare's Workers runtime instead of executing the services in Node against local D1 proxies.

The actual built Next.js/OpenNext application still receives real HTTP requests through Wrangler's local test harness. Its 12-check journey is now run by Vitest too. No booking behavior, production dependency version, application route, production migration, adapter configuration or live infrastructure changed.

## Test arrangement

| Project | Runs where | Coverage |
| --- | --- | --- |
| backend | Local workerd through @cloudflare/vitest-plugin | The existing 24 D1 scenarios, including fresh installation, populated upgrades, races, retries, snapshots, lifecycle and authorization |
| worker-http | Vitest's Node environment orchestrates Wrangler's local built-Worker harness | One ordered application journey retaining all 12 existing HTTP checks |

Vitest reports **25 tests across four files**: 24 database tests plus one HTTP journey. The 12 HTTP checks are not falsely counted as 12 independent Vitest tests. Each assertion still runs, and the journey asserts its completed-check count is 12.

The Node environment for harness orchestration does not replace the Workers runtime used by the built application. It also does not restore Node's built-in test runner.

Files:
- application/vitest.config.ts selects both projects.
- application/vitest.backend.config.ts derives database binding names, migration settings, compatibility date and flags from the application Wrangler configuration. It creates local test bindings and does not import the built Next.js entrypoint.
- application/vitest.worker.config.ts selects the built-Worker HTTP journey.
- application/tests/fixtures.ts retains the synthetic fixture/request/scalar behavior without importing Node-only or Workers-only setup code.
- application/tests/support.ts uses native test bindings, reset() and applyD1Migrations().

Storage isolation in the plugin is per file. The database helper explicitly resets storage before and after each scenario, preserving the original fresh-database semantics even for immutable history. Scenario tests remain sequential within a file; their Promise.all races are retained.

Migration discovery now uses Cloudflare's readD1Migrations() with the application's configured directory/pattern. The custom SQL splitter and default list of three filenames are removed. Upgrade fixtures deliberately name their historical stages, while normal installation discovers the full current set. The fresh-install scenario also checks migration tracking against the discovered set and verifies reapplication does not duplicate migrations.

The built-Worker harness uses its own applyD1Migrations("DB") method, reading the binding's migration settings. It does not import the native Workers-only setup module.

## Versions and scope

Added exact dev dependencies:
- vitest 5.0.5
- @cloudflare/vitest-plugin 1.4.9

The plugin's installed peer range supports Vitest ^4.1.0 or ^5.0.0. Its Wrangler dependency is 4.154.0, matching the existing application. The observed runtime was Node 24.22.1 and npm 11.19.1. The existing packageManager declaration remains npm 11.9.0; standardizing local/CI package-manager versions remains an explicit tooling follow-up, not a silent change here.

No pre-existing lockfile package version changed. The current production version tuple remains Next.js 16.4.3, React 19.3.1, Better Auth 1.7.14, Drizzle 0.45.4 and OpenNext 1.20.13. The historical proof is untouched.

## Verification

| Check | Observed local result |
| --- | --- |
| Original built-in-runner D1 baseline, before migration | 24 passed |
| Vitest backend project inside workerd | 24 passed |
| Vitest built-Worker journey | All 12 HTTP checks passed |
| Combined npm test after fresh build | 25 tests / four files passed; no unhandled errors |
| TypeScript | Passed |
| Next.js production build | Passed |
| OpenNext Worker bundle | Passed |
| Fixture extraction and production-file scope | Fixture body unchanged; no changes to application/src, app, production migrations or adapter/Worker config |

An initial migration-fixture conversion retained a Node-only proxy import because of line-ending differences. The first Vitest attempt correctly failed with an unhandled runtime error; it was not accepted as a pass. The fixture was corrected to use native bindings and all 24 scenarios passed.

The first bounded build command reached its time limit while Next.js collected traces. A subsequent build with a durable completion record finished successfully with exit 0, and the combined test run exercised that rebuilt bundle. OpenNext's existing Windows compatibility advisory was emitted. These facts do not establish Linux CI, staging or production verification.

Reproduction from application/:

~~~sh
npm ci
npm run init:local
npm run types:bindings
npm run typecheck
npm run test:backend
npm run build:worker
npm test
~~~

For just the built-Worker journey after building, run npm run test:worker. Both npm test and test:worker require a current built bundle. No live email is sent; auth mail is captured in the disposable test database.

## Existing dependency audit finding

npm audit reports four high-severity entries along the existing OpenNext build-tool chain:
@opennextjs/cloudflare -> @opennextjs/aws -> @node-minify/core -> glob 10.3.3.

They trace to [GHSA-5j98-mcp5-4vw2](https://github.com/advisories/GHSA-5j98-mcp5-4vw2), concerning glob's CLI command option. The vulnerable nested glob 10.3.3 and the same build package versions already exist in the baseline lockfile; this migration did not introduce or upgrade them. The advisory distinguishes CLI use from library API use; actual project exploitability is not assessed by the audit count alone.

Do not apply npm audit fix --force as part of a test-runner change: its suggested adapter replacement would change the tested application tuple. Track a separate dependency/security review and a verified compatible remedy before release. Passing this test migration does not resolve that finding.

## What comes next

Step 2 remains regression-backed database hardening: supported cancellation cutoff, command-to-transition consistency, non-null identities, coherent valid instants and other findings in the approved booking design. Migration-loader alignment is already completed here because the native testing integration needs its supported loader.

Module extraction, workspace movement, package-manager changes, providers, policy decisions, staging and live deployment remain outside this change.

## References checked

- [Workers Vitest integration](https://developers.cloudflare.com/workers/testing/vitest-integration/)
- [Workers test configuration and migration loader](https://developers.cloudflare.com/workers/testing/vitest-integration/configuration/)
- [Workers test APIs and reset](https://developers.cloudflare.com/workers/testing/vitest-integration/test-apis/)
- [Vitest projects](https://vitest.dev/guide/projects)

Registry metadata and installed package declarations were checked before choosing versions. Test results are local repository evidence.
