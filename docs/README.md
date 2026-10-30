# Documentation map and authority

**Status:** canonical reading map.

**Responsible role:** maintainer (responsibility, not an assigned person).

**Last source verification:** 29 October 2026; guest-browsing implementation based on [ef971f1](https://github.com/kimsourly1912/root-of-cambodia/commit/ef971f1a863c6211a9a55fb1223982327fc5fdf7).

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
- [Accepted publication checklist](product/publication-checklist-proposal.md): approved D05 minimum and remaining boundaries
- [Accepted guest-browsing slice](product/guest-browsing-proposal.md): public field/media boundary and explicit owner acknowledgement
- [Owner availability and external reservation steps](product/owner-inventory-operations.md): missing owner interfaces over existing stock rules
- [Selected arrival/completion and payment-record scope](product/stay-operations.md): two local steps under delegated recommendations; money is paid outside the platform
- [Accepted booking journey](product/booking-journey-proposal.md): guest request/tracking, owner response and D17 privacy/copy decision
- [Architecture overview and module map](architecture/overview.md)
- [Database and operation invariants](architecture/database.md)
- [ADR 0001: Modular monolith](architecture/decisions/0001-modular-monolith.md)
- [ADR 0002: Atomic booking operations](architecture/decisions/0002-atomic-booking-operations.md)
- [ADR 0003: pnpm workspace](architecture/decisions/0003-pnpm-workspace.md)
- [ADR 0004: Private media lifecycle](architecture/decisions/0004-private-media-lifecycle.md)
- [ADR 0005: Public listing boundary](architecture/decisions/0005-public-listing-boundary.md)
- [ADR 0006: Booking journey and private disclosure](architecture/decisions/0006-booking-journey.md)

## Feature contracts

- [Guest browsing](features/guest-browsing.md): anonymous allowlisted stays, confirmation-bound approval and routed processed media

- [Private owner supply](features/owner-supply.md): drafts/rooms/calendar/information/photos; actual fields/routes/revisions/retry boundaries
- [Pilot publication review](features/publication-review.md): single reviewer, submission snapshots, corrections, terms gate and retries
- [Bookings and stock](features/bookings.md): quotes/snapshots/actions/external allocation and ordinary stay screens
- [Property payment records](features/payments.md): full external-payment attestations, private correction history and independent booking state
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
