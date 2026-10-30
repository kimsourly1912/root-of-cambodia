# ROOTS OF CAMBODIA — Agent instructions

## Read first

Read [docs index](docs/README.md), [status](docs/status.md), the affected feature,
[architecture](docs/architecture/overview.md) and relevant accepted ADRs.
[Product scope](docs/product/scope.md) is policy authority;
[open decisions](docs/product/open-decisions.md) are not permission to invent policy.
Inspect source/config/tests and report material conflicts before changing behavior.

## Project and boundaries

The current app is a local owner-supply, guest-browsing and booking-screen foundation.
Accommodation is request-to-book and pay-at-property. Ordinary owner-attested
arrival/completion and full external-payment bookkeeping are implemented locally.
Exceptional stay handling, broad admin/support and live providers are unfinished.
A configured single-reviewer publication flow is local pilot scope.

Use the root packageManager/Node pins and committed pnpm lockfile.

- apps/web: Next.js/React UI and thin OpenNext/Workers adapters.
- apps/jobs: scheduled/queue adapters calling shared services.
- packages/backend: business services, authorized reads and atomic persistence.
- packages/backend/migrations: authoritative ordered SQL.
- proofs/foundation: independent historical npm fixture, not the active app.

Keep routes thin and business rules in services; named persistence owns complete
atomic saves. Backend must not import Next.js/React or either app. Browser code
must not import runtime bindings, persistence or secrets. Prefer existing typed
patterns; preserve unrelated changes. See the architecture for module boundaries
and known enforcement limits.

## Correctness and privacy

Recheck verified identity/ownership at sensitive boundaries and commit time.
Preserve quote snapshots, legal transitions and stock invariants. Operation,
writes, required history/outbox and receipt must remain atomic. Retry uncertain
outcomes with the same key/payload; never automatically invent a fresh attempt.
Bound/validate server input, keep private responses/media uncached and never log
secrets, tokens, raw provider errors or guest data. Follow the
[database contract](docs/architecture/database.md) and affected feature docs.

Add ordered migrations rather than rewriting applied ones; verify fresh and
populated upgrades when schema changes are authorized. Preserve application/
compatibility state and scripts/handoff-local.ts. Do not bypass local-only
provider guards to make a deployment pass.

## Verification and delivery

Follow [setup](docs/development/setup.md), [testing](docs/development/testing.md)
and [contributing/handoff](docs/development/contributing.md). Local init writes
state/applies migrations: do not run it when task scope excludes it. Run
scope-appropriate checks and report actual commands, SHA, environment and limits;
historical or skipped checks are not fresh results. Update canonical contracts
with behavior and keep current evidence in status/PR, not duplicated READMEs.

Task instructions and already granted approvals govern authorization. Do not
merge, deploy, spend money, change repository settings, mutate production,
delete data/change retention or apply remote migrations without authorization.
Do not re-request actions already authorized. Keep PRs focused; use the
[PR template](.github/pull_request_template.md) and
[release gates](docs/operations/release-and-recovery.md).
