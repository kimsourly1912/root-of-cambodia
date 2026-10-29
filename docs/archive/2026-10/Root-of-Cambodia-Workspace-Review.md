> **Historical snapshot — not current instructions.** Archived 29 October 2026 from [docs/Root-of-Cambodia-Workspace-Review.md at 607a705](https://github.com/kimsourly1912/root-of-cambodia/blob/607a7057b908a005f9f3529141b0978f52d24ce0/docs/Root-of-Cambodia-Workspace-Review.md). Original dates, decisions, PR states and results below are historical.
> **Current authority:** [docs/development/setup.md](../../development/setup.md), [docs/development/testing.md](../../development/testing.md).
> Historical text is preserved; relative link destinations are adjusted only for relocation. Do not execute old setup or prototype prompts as current guidance.

<!-- historical-body-start -->

# Root of Cambodia — Workspace and Jobs Review

Date: 28 October 2026
Scope: implementation-plan step 4, approved by the owner in conversation (“Yes sure”). PR #8 was checked open/draft before implementation and is being updated in place. Baseline main: 22347591d7b3a20373bc7464b1974edd96c7ded8, with PR #7 merged.

## Outcome

The website and jobs Worker now have separate entrypoints and use the same backend package. Booking decisions still have one implementation, and a booking/inventory change still saves atomically. The approved Next.js, Workers/D1, Drizzle, Better Auth, Vitest and npm choices remain. Payment remains at the property.

| Location | Responsibility |
| --- | --- |
| [apps/web](readmes/web-README.md) | Existing Next.js routes/pages, OpenNext binding lookup, cookie/session transport and local auth-mail capture |
| [apps/jobs](readmes/jobs-README.md) | Thin scheduled/queue handlers, local queue binding and local notification capture |
| [packages/backend](readmes/backend-README.md) | Shared services, scoped reads, atomic persistence, Better Auth factory, Drizzle projections and outbox operations |
| [packages/backend/migrations](../../../packages/backend/migrations) | One authoritative set of four unchanged SQL files |
| tests/ | Retained scenarios/fixtures, new handler/runtime/boundary checks and built-Worker journeys |
| Root manifest/lockfile | Three private native npm workspaces and common developer commands |

All 13 shared business modules and four migration files are byte-identical to their pre-move versions. HTTP routes change only their imports. No new product rule, transaction model or lifecycle SQL was added. Arrival remains blocked. Root commands and current documentation links were updated; historical reports retain their original evidence limits.

The owner approved the exact [workspace plan](Root-of-Cambodia-Workspace-Plan.md), including a root lockfile. All 506 existing third-party package entries retain version, integrity and resolution. No workspace orchestrator or third-party dependency was added. The historical proof remains outside the workspace with its independent manifest/lockfile, unchanged.

## Boundaries and recovery

The shared package exposes explicit TypeScript subpaths and cannot import Next.js, OpenNext or either app. The web app preserves its CloudflareEnv name for OpenNext compatibility. Generated runtime types live separately from each app's binding types, allowing independent web/jobs/backend/test typechecks. Next.js transpiles the shared package and traces from the repository root.

The scheduled handler delegates to existing maintenance; the queue handler delegates to existing consume. A queue message is acknowledged after success, duplicate/discard handling or a durable outbox backoff. A thrown/uncertain database failure requests retry with the same ID. Expired leases and due rows remain sweepable. No email is sent inside a booking transaction.

The jobs provider is explicitly local capture: local_notification stores synthetic messages using the outbox ID as its stable key. It does not send real email. It preserves capture deduplication after an uncertain acknowledgement. Both handlers reject nonlocal mode before acknowledgement or business writes. Local queue configuration exists; no automatic Cron schedule, live provider, remote queue or other infrastructure was provisioned.

Both app configurations reference the same local D1 identity and authoritative migration directory. Only root init:local owns migration application; neither runtime auto-migrates. Web/jobs previews share root .wrangler/state; stop previews before the first local handoff. Initialization copies legacy application local state/secret once, keeps originals and refuses conflicting destinations. Tests prove byte preservation and that repeated initialization does not overwrite newer workspace state. This checkout's retained migration tracking was recognized without reapplying migrations. This is a developer-state handoff, not a production database conversion.

## Fresh local verification

Linux, Node 24.22.1, npm 11.9.0; framework/runtime/test dependencies retain their existing pinned versions.

| Check | Result |
| --- | --- |
| Fresh root npm ci | Passed; local workspace packages resolved |
| Independent proof npm ci | Passed; proof source/manifest/lockfile unchanged |
| Shared source/migration comparison | All 17 moved files byte-identical |
| Dependency-lock comparison | All 506 existing third-party entries retain version/integrity/resolution |
| Binding/runtime type generation | Passed, using pinned Wrangler/workerd |
| Web, jobs, backend and test typechecks | Passed separately |
| Native Workers/D1 suite | 64 passed: all 60 existing scenarios plus four actual-handler regressions |
| Workspace/local-handoff suite | Three passed |
| Next.js/OpenNext build | Passed from apps/web with shared package imports |
| Jobs build | Passed; Wrangler dry-run writes local dist only |
| Built web Worker | All 12 original HTTP checks retained; the two actual bundles also share D1 and deliver web-created outbox records through jobs |
| Built jobs Worker | Prebuilt bundle handles overlapping scheduled expiry and real local queue/capture delivery; a duplicate preserves the original delivery attempt |
| Combined npm test | 69 tests across nine files passed |
| Formatting, whitespace and documentation links | Passed |

The new handler regressions cover overlapping expiry/publication recovery, failed provider/backoff recovery, duplicate messages, uncertain database acknowledgement and nonlocal fail-closed behavior. The built jobs journey loads dist through the pinned harness's prebuiltWorkerDir option. Existing race, rollback, snapshots, authorization, receipt recovery and fresh/populated-upgrade assertions remain. The historical deadline helper is reused without weakening its scenarios; its fixture key now has an explicit string type for the separately checked test environment.

These are synthetic local results, not production verification. A built jobs test exercises local queue/runtime behavior; it does not establish remote scheduling, throughput, delivery guarantees or inbox arrival.

## Remaining risks and next work

Step 4 is complete locally and ready for review. Step 5 diagnostics/delivery contracts is next: safe failure/correlation codes, stale-lease cases, provider acceptance versus inbox delivery and operational recovery. The existing OpenNext dependency audit finding remains unresolved; this migration deliberately retains versions.

Arrival/no-show/late cancellation, infant/age definitions, detailed room-party distribution, physical-room continuity, external contact/negotiated-price/consent contracts, audited admin/support access and suspension procedures remain unresolved. No policy was inferred while moving code.

Provider/domain, auth-mail reliability, reminders, retention/erasure, live retry/dead-letter operations, load, monitoring and restore targets remain open. Remote D1/HTTPS/auth, Cron/Queues and provider integration need separately authorized staging work. No pull request was merged, no real email was sent and no infrastructure was deployed.
