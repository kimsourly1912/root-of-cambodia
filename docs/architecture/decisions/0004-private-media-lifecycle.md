# ADR 0004: Private draft media lifecycle

**Status:** accepted existing R2/Images direction; records implemented engineering pattern.

**Responsible role:** technical maintainer; project owner for unresolved policy (responsibility, not an assigned person).

**Last source verification:** 29 October 2026; guest-browsing implementation based on [ef971f1](https://github.com/kimsourly1912/root-of-cambodia/commit/ef971f1a863c6211a9a55fb1223982327fc5fdf7).

**Sources:** [docs/archive/2026-10/Root-of-Cambodia-Architecture.md](../../archive/2026-10/Root-of-Cambodia-Architecture.md), [docs/archive/2026-10/Root-of-Cambodia-Property-Photos-Review.md](../../archive/2026-10/Root-of-Cambodia-Property-Photos-Review.md), [packages/backend/src/media.ts](../../../packages/backend/src/media.ts), [packages/backend/migrations/0009_property_media.sql](../../../packages/backend/migrations/0009_property_media.sql).

**Recorded:** 29 October 2026.
**Provenance:** R2/Images and private originals are part of the owner-approved architecture. The photo review records journal/preview/tombstone choices as routine implementation inside that direction; photo code is merged via PR #15 at the verified baseline. This ADR records that implemented pattern, not a separately evidenced owner approval of retention, fees, quotas or public delivery.

## Context and decision

D1 and R2 cannot share a transaction. Register an immutable upload descriptor and receipt in D1 before object writes; derive keys server-side. Write private original/processed preview conditionally, then mark ready only after both succeed. Ready retries do not rewrite objects.

A versioned gallery requires the complete current active set for reordering. Removal immediately denies new preview reads, records a durable tombstone and allows bounded maintenance to delete both paths repeatedly to catch late in-flight writes. Failed/unfinished assets stay private and recoverable.

Browser reads expose authenticated processed JPEG previews, never originals or unrestricted storage credentials. Previews are bounded and metadata-stripped; original metadata remains private.

## Alternatives and consequences

Writing objects before journaling risks orphaned/unattributed work. Claiming a cross-service transaction or exactly-once cleanup would be false. Journaling/tombstones recover interruptions but leave retained records and repeated cleanup cost. Already downloaded bytes cannot be recalled.

Limits and payloads are documented in [owner supply](../../features/owner-supply.md). Emulated Images behavior is not a live-fidelity guarantee.

## Supersession and open policy

The upload/original lifecycle remains in force. [ADR 0005](0005-public-listing-boundary.md) adds the accepted explicit processed-public-read boundary; it does not make originals public. This record does not approve abandoned-upload expiry, original/tombstone/history retention or destructive purge. D05/D09/D11 in [open decisions](../../product/open-decisions.md) cover publication/cover/delivery variants, retention and abuse/storage budgets. Cleanup scheduling, cost, staging permissions and recovery remain release gates.
