# Root of Cambodia — Step 4 Workspace Proposal

Date: 28 October 2026
Status: Approved by the project owner in conversation on 28 October 2026 (“Yes sure”), then implemented and verified locally. See the [step 4 review](Root-of-Cambodia-Workspace-Review.md). This approval does not authorize deployment or merging a pull request.
Baseline: main at 22347591d7b3a20373bc7464b1974edd96c7ded8. PR #7 is merged; this commit's source tree is identical to tested step-3 commit 2c9ae0142b0982e822267f5bf854ac798d8a7368.

## Approved decision

Subsequent amendment (28 October 2026): the owner explicitly requested pnpm. The folder layout remains approved; the earlier npm choice below is superseded by the [pnpm workspace review](Root-of-Cambodia-Pnpm-Workspace-Review.md).

Use three private npm workspaces in this repository: apps/web, apps/jobs and packages/backend. Keep npm 11.9.0, Node 24.22.1 and the current pinned dependencies. Move the active application lockfile to one root workspace lockfile, preserving existing resolved dependency versions. The historical proof stays outside the workspace with its existing independent lockfile.

This gives the website and background worker their own startup/configuration code while both import the same booking services and database operations. It implements the approved [architecture](Root-of-Cambodia-Architecture.md); it does not create another booking API or database.

The [implementation plan](Root-of-Cambodia-Implementation-Plan.md) explicitly leaves the concrete workspace/layout choice open. Agreement on this proposal authorizes the source/tooling migration and its local verification, not deployment, purchases, policy changes or merging a pull request.

## Concrete layout

| Destination | Existing content / purpose |
| --- | --- |
| apps/web/app/ | Existing application/app/ Next.js pages and API routes |
| apps/web/src/ | Existing http.ts and runtime.ts; web transport, session adaptation and local auth-mail adapter |
| apps/web/ | Next.js/OpenNext configuration, web Wrangler configuration, public assets and local setup script |
| apps/jobs/src/ | New thin scheduled/queue Worker entrypoint and runtime/provider adapters |
| packages/backend/src/ | Existing bookings, quote, inventory, access, operations, schema, errors, auth factory, outbox and jobs orchestration files |
| packages/backend/migrations/ | The existing four authoritative SQL migrations, moved byte-for-byte |
| tests/ | Existing D1 and built-Worker suites/fixtures, plus focused jobs-entrypoint and import-boundary tests |
| Repository root | Private workspace manifest, application workspace lockfile, shared test configuration and developer commands |
| docs/ and proofs/foundation/ | Plans/reports remain; historical proof stays independent |

The backend initially retains its current descriptive filenames. Further business-module subfolders can be introduced when a feature needs them; this avoids combining the shared-package move with another refactor of the tested service boundaries. No empty future modules, UI package, generic repositories or separate contracts package are needed now.

## Dependency and runtime boundaries

- Both apps import explicit server-side subpaths of the private @root-of-cambodia/backend package. Backend code cannot import either app, Next.js or OpenNext runtime code. Existing D1 types remain part of its database boundary.
- Better Auth's configured factory can live in the backend because it does not import Next.js. Session/cookie transport and the OpenNext binding lookup stay in the web app. Jobs import only their required backend subpaths.
- Web routes keep the same URLs, validation, verified-session checks, private responses, fingerprints and receipt semantics.
- Jobs call the existing maintenance/consume operations. Scheduled work reuses expiry and publication; queue work reuses delivery. No lifecycle SQL is copied into entrypoints.
- Both runtime configurations reference the same migration directory and, per environment, the same booking database. One documented migration command owns schema changes; the apps do not auto-migrate on requests or compete to apply migrations.
- Keep local-only configuration and adapters. Exercise scheduled/queue handlers locally using test doubles/capture adapters. An unconfigured live provider must not silently mark messages delivered. Real providers, Cron/Queue provisioning and deployment remain separate work.

## Tooling changes included in implementation

Retain npm and native npm workspaces; add no workspace orchestrator, framework or test runner. Root commands cover installation, local initialization, binding types, type checks, backend/jobs tests, the web Worker build and its HTTP journey. Preserve the historical proof's separate commands.

Regenerate workspace lock metadata with the existing package versions. Compare resolved package versions/integrities against the application lockfile; investigate drift rather than silently accepting upgrades. If compatibility requires changing versions, report the reason and proposed adjustment first.

Update package exports, TypeScript includes, generated binding locations, Next.js workspace compilation/tracing, OpenNext build paths and test-harness configuration paths. The installed Next.js 16.4.3 types include transpilePackages and outputFileTracingRoot; verify the actual bundle rather than assuming moving imports is sufficient.

Local Wrangler state and ignored secrets require deliberate path handling. A source-folder move is not a data migration: preserve existing developer state or document an explicit local handoff; never commit secrets/state or silently reset a populated database. Fresh synthetic test databases stay disposable.

## Required evidence before step 4 can be called complete

1. Fresh root npm ci, correct local workspace resolution and unchanged third-party dependency versions; the proof remains independently installable.
2. Preserve all 60 D1 scenarios and the built web Worker's 12 HTTP checks. Existing fresh/populated upgrades and rejection/replay cases must use the moved, unchanged migration set.
3. Add meaningful checks for the new boundary: shared code cannot import web/Next runtime; actual jobs handlers use the shared operations, tolerate duplicate/overlapping work, and preserve recoverability on publication/delivery failure.
4. Generate types and typecheck web, jobs, backend and tests separately. Build Next.js/OpenNext and validate the jobs bundle under the pinned local Workers tooling.
5. Verify the actual web bundle's sessions/routes and the actual jobs entrypoint after the move. Validate migration discovery, documentation links and package exports from their final paths.
6. Update the implementation plan and a short review report, then open/update an implementation PR. Do not deploy or merge it.

## Proposal-stage evidence and limits (historical)

PR #7's merged state and source equality were checked. Current imports/configuration were inspected, and npm/Next.js workspace guidance was consulted. No application source, schema, dependency lockfile or runtime configuration changed in this proposal. No tests were rerun for this documentation-only change; step 3's recorded 61-test result remains historical local evidence.

Arrival stays blocked. No-show/late cancellation, infant/age bands, physical-room continuity, external contact/price/consent and admin/support policies remain open. Provider/domain, reminders, delivery diagnostics, retention, load, monitoring and restore verification remain later decisions/work. The owner subsequently approved the exact layout/tooling in conversation; that decision is recorded above. Product-policy questions remain unresolved.

## Primary technical references

- [npm 11 workspaces](https://docs.npmjs.com/cli/v11/using-npm/workspaces/)
- [Next.js transpilePackages](https://nextjs.org/docs/app/api-reference/config/next-config-js/transpilePackages)
- [Next.js output tracing and monorepo caveats](https://nextjs.org/docs/app/api-reference/config/next-config-js/output)

These describe supported mechanisms; actual implementation verification is recorded in the [workspace review](Root-of-Cambodia-Workspace-Review.md).
