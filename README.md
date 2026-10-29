# ROOTS OF CAMBODIA

**Status:** private owner-supply foundation with booking APIs.

**Responsible role:** maintainer (responsibility, not an assigned person).

**Last source verification:** 29 October 2026, [607a705](https://github.com/kimsourly1912/root-of-cambodia/commit/607a7057b908a005f9f3529141b0978f52d24ce0).

**Sources:** [package.json](package.json), [apps/web/app/](apps/web/app), [packages/backend/src/](packages/backend/src).

A Cambodia discovery and accommodation platform in development. Guests request stays and pay the property directly. Current code provides verified owner access, private property/room/calendar/information/photo setup and booking APIs. Public discovery, publication review, complete guest/arrival journeys and live providers remain unfinished.

Start with the [documentation map](docs/README.md) and [current status/evidence](docs/status.md). For development use [setup](docs/development/setup.md) and [testing](docs/development/testing.md); agents must read [AGENTS.md](AGENTS.md).

| Workspace | Role |
| --- | --- |
| [apps/web](apps/web/README.md) | Next.js/React interface and OpenNext/Workers adapters |
| [apps/jobs](apps/jobs/README.md) | Scheduled/queue adapters |
| [packages/backend](packages/backend/README.md) | Shared TypeScript business/read/atomic persistence contracts |

The root manifests pin active pnpm/Node tooling; the [independent proof](proofs/foundation/README.md) alone retains historical npm reproduction instructions. Use one canonical [setup sequence](docs/development/setup.md#full-local-verification-sequence), including both Worker builds before the full suite.

[Accepted product rules](docs/product/scope.md), [architecture/ADRs](docs/architecture/overview.md), [open decisions](docs/product/open-decisions.md) and [release/recovery gates](docs/operations/release-and-recovery.md) separate policy, implementation and future work. Checked-in runtime configurations are local-only and fail closed outside local capture mode.

Historical reviews and the previous READMEs are preserved with a complete [disposition map](docs/archive/README.md). Their old commands/counts/PR states are snapshots, not active instructions.
