# ROOTS OF CAMBODIA

**Status:** pre-pilot accommodation booking foundation; fixture-only Cloudflare staging, no production deployment.

**Responsible role:** maintainer (responsibility, not an assigned person).

**Last source verification:** 31 October 2026, main [40f7ffa](https://github.com/kimsourly1912/root-of-cambodia/commit/40f7ffa553a14005f622aa5c846f0f9dc5e70f42).

**Sources:** [package.json](package.json), [apps/web/app/](apps/web/app), [packages/backend/src/](packages/backend/src).

A Cambodia discovery and accommodation platform in development. Guests request stays and pay the property directly. Current code provides verified owner access, private property/room/calendar/information/photo setup and booking APIs. Anonymous stay browsing now shows only explicitly authorized, reviewed listing content and processed photos. Guest request/tracking, owner responses, owner availability and external reservations, listing pause/corrections, schedule-bounded arrival/completion and full external-payment bookkeeping are implemented locally; exceptional stay handling, broader moderation and live providers remain unfinished; see current status for verification limits.

Start with the [documentation map](docs/README.md) and [current status/evidence](docs/status.md). For development use [setup](docs/development/setup.md) and [testing](docs/development/testing.md); agents must read [AGENTS.md](AGENTS.md) (Claude Code loads it through [CLAUDE.md](CLAUDE.md)) and use the [playbooks](docs/playbooks/README.md).

| Workspace | Role |
| --- | --- |
| [apps/web](apps/web/README.md) | Next.js/React interface and OpenNext/Workers adapters |
| [apps/jobs](apps/jobs/README.md) | Scheduled/queue adapters |
| [packages/backend](packages/backend/README.md) | Shared TypeScript business/read/atomic persistence contracts |

The root manifests pin active pnpm/Node tooling; the [independent proof](proofs/foundation/README.md) alone retains historical npm reproduction instructions. Use one canonical [setup sequence](docs/development/setup.md#full-local-verification-sequence), including both Worker builds before the full suite.

[Accepted product rules](docs/product/scope.md), [architecture/ADRs](docs/architecture/overview.md), [open decisions](docs/product/open-decisions.md) and [release/recovery gates](docs/operations/release-and-recovery.md) separate policy, implementation and future work. Runtime guards retain loopback local capture and an explicit [staging modes](docs/operations/staging.md) (read-only, and fictional-fixture testing) while email is deferred; other nonlocal behavior fails closed.

Historical reviews and the previous READMEs are preserved with a complete [disposition map](docs/archive/README.md). Their old commands/counts/PR states are snapshots, not active instructions.
