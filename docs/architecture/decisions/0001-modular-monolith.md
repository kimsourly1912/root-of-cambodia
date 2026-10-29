# ADR 0001: Modular monolith on Workers

**Status:** accepted; existing decision transcribed.

**Responsible role:** project owner / technical maintainer (responsibility, not an assigned person).

**Last source verification:** 29 October 2026, [607a705](https://github.com/kimsourly1912/root-of-cambodia/commit/607a7057b908a005f9f3529141b0978f52d24ce0).

**Sources:** [docs/archive/2026-10/Root-of-Cambodia-Architecture.md](../../archive/2026-10/Root-of-Cambodia-Architecture.md), [docs/archive/2026-10/Root-of-Cambodia-Workspace-Plan.md](../../archive/2026-10/Root-of-Cambodia-Workspace-Plan.md).

**Original decision:** 28 October 2026. **Transcribed:** 29 October 2026.
**Approval provenance:** the archived architecture explicitly records owner approval; the workspace plan records the subsequently approved layout. This transcription does not approve new source moves, providers or deployment.

## Context and decision

Guest, owner and future platform areas share booking/inventory rules. Keep one Next.js/React/TypeScript application on Workers through OpenNext, one scheduled/queue Worker and a private shared TypeScript backend library. Start with one D1 per environment, Drizzle selected reads, reviewed SQL atomic writes, Better Auth, R2/Images and shadcn/Tailwind.

The implemented layout is apps/web, apps/jobs and packages/backend. Keep services, authorized reads and named atomic persistence separate. Shared code is a library, not a network API.

## Alternatives and consequences

Separate guest/owner backends, microservices or a new Hono server add coordination/deployment without an established need. Database partitioning/replacement is deferred until measurements justify it. The chosen layout reduces operational complexity and keeps booking writes together, but D1 limits and OpenNext compatibility require measured verification; SQL portability is not automatic.

## Supersession and boundaries

Earlier framework/database alternatives remain historical research. Tooling is amended by [ADR 0003](0003-pnpm-workspace.md); atomic writes by [ADR 0002](0002-atomic-booking-operations.md). No new architecture decision supersedes this record. Current behavior and known boundary-enforcement limits live in [overview](../overview.md). Live provider/environment selection remains open.
