# Documentation map and authority

**Status:** canonical reading map.

**Responsible role:** maintainer (responsibility, not an assigned person).

**Last source verification:** 29 October 2026, [607a705](https://github.com/kimsourly1912/root-of-cambodia/commit/607a7057b908a005f9f3529141b0978f52d24ce0).

**Sources:** [docs/status.md](status.md), [docs/product/scope.md](product/scope.md), [docs/architecture/overview.md](architecture/overview.md), [docs/archive/README.md](archive/README.md).

Start with [current status](status.md), then [accepted product scope](product/scope.md) and the affected feature/architecture contract. Developers use [setup](development/setup.md) and [testing](development/testing.md); agents also read root [AGENTS](../AGENTS.md).

## Authority and conflicts

| Information | Canonical authority / evidence |
| --- | --- |
| Task authorization | Current explicit user instructions and already granted approvals |
| Product policy | [Scope](product/scope.md); new decisions require owner approval |
| Unsettled choices | [Open decisions](product/open-decisions.md), with IDs/decision owner/blocking impact |
| Accepted architecture | [Overview](architecture/overview.md), [database contract](architecture/database.md) and accepted ADRs |
| Actual behavior/schema | Source/config/tests and ordered SQL migrations; feature docs explain them |
| Executable commands/versions | Root/package manifests, lockfile/config and CI; [setup](development/setup.md) provides one sequence |
| Current delivery and evidence | [Status](status.md): SHA/run, implemented/planned/blocked and environment boundaries |
| Historical reasoning/results | [Archive](archive/README.md): preserved snapshots, not active execution instructions |

Report material disagreement. Do not silently rewrite approved policy to match accidental code or call a planned API implemented because a specification lists it. “Verified” must name the evidence/environment: source inspection is not a newly executed test, local emulation is not deployed-service proof.

## Product and architecture

- [Product scope](product/scope.md)
- [Open decisions](product/open-decisions.md)
- [Architecture overview and module map](architecture/overview.md)
- [Database and operation invariants](architecture/database.md)
- [ADR 0001: Modular monolith](architecture/decisions/0001-modular-monolith.md)
- [ADR 0002: Atomic booking operations](architecture/decisions/0002-atomic-booking-operations.md)
- [ADR 0003: pnpm workspace](architecture/decisions/0003-pnpm-workspace.md)
- [ADR 0004: Private media lifecycle](architecture/decisions/0004-private-media-lifecycle.md)

## Feature contracts

- [Private owner supply](features/owner-supply.md): drafts/rooms/calendar/information/photos; actual fields/routes/revisions/retry boundaries
- [Pilot publication review](features/publication-review.md): single reviewer, submission snapshots, corrections, terms gate and retries
- [Bookings and stock](features/bookings.md): quotes/snapshots/actions/external allocation; arrival gate; planned UI
- [Notifications and diagnostics](features/notifications.md): recipient/outbox/lease/provider acceptance and privacy

## Design, development and operations

- [Screen brief](design/screen-brief.md): existing component reuse and explicitly planned flows
- [Local setup](development/setup.md): commands, side effects, capture and legacy-state handoff
- [Testing](development/testing.md): runtime layers, focused/full checks and fidelity
- [Contributing/handoff/definition of done](development/contributing.md)
- [Release and recovery](operations/release-and-recovery.md): local-only configuration, unverified live gates and recovery gaps
- [Current status and next scope](status.md)
- [Historical archive and all-original disposition map](archive/README.md)

Package entrypoints remain short: [web](../apps/web/README.md), [jobs](../apps/jobs/README.md), [backend](../packages/backend/README.md). The [historical proof](../proofs/foundation/README.md) is independent; the [UI license](../apps/web/components/ui/LICENSE.md) stays verbatim in place.

## Maintenance conventions

Canonical documents state status, responsible role, last source verification date/SHA and source links. Roles name responsibilities, not invented team assignments. Use lowercase kebab-case for new files, relative repo links and commit-pinned URLs for snapshot evidence. Update contracts alongside behavior and status when new evidence changes delivery claims; keep counts/versions centralized.

Old filenames are redirect pages for incoming references. Archived originals retain their dates/commits/results and relative links adjusted for relocation. Do not execute obsolete commands/prompts from them as current guidance. No CODEOWNERS is added until real reviewers and policy are assigned.
