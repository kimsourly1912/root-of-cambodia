# ADR 0002: Atomic booking operations

**Status:** accepted; existing detailed design transcribed.

**Responsible role:** project owner / backend maintainer (responsibility, not an assigned person).

**Last source verification:** 29 October 2026, [607a705](https://github.com/kimsourly1912/root-of-cambodia/commit/607a7057b908a005f9f3529141b0978f52d24ce0).

**Sources:** [docs/archive/2026-10/Root-of-Cambodia-Booking-Database-Design.md](../../archive/2026-10/Root-of-Cambodia-Booking-Database-Design.md), [docs/archive/2026-10/Root-of-Cambodia-Service-Boundaries.md](../../archive/2026-10/Root-of-Cambodia-Service-Boundaries.md).

**Original decision:** 28 October 2026. **Transcribed:** 29 October 2026.
**Approval provenance:** the archived detailed design, section 11, explicitly records owner approval of TypeScript services, named atomic D1 saves, bounded constraints/triggers and transactional history/outbox. Later safeguard/service reviews provide implementation evidence, not additional policy approval.

## Context and decision

Two valid requests can compete for the same final unit; zero-row SQL updates do not inherently abort later effects. Keep each operation's write-time authorization, snapshot/transition, all allocations/releases, history/outbox and success receipt in one guarded D1 batch. Services coordinate intent and validation; named persistence owns the complete save; bounded triggers/constraints enforce critical invariants.

Submission seals complete immutable quote lines/nights/charges/policies. Pending holds no stock. Cancellation releases committed allocations once. Same-key/payload retries recover original successful receipts; uncertain outcomes never automatically create a fresh operation. SQL migrations remain authoritative; Drizzle is a partial read mapping.

## Alternatives and consequences

Explicit side-effect statements in one guarded batch could also be correct, but replacing proven triggers has no demonstrated benefit now. Independently committed repositories cannot satisfy this contract. A separate coordination server does not remove the need for database consistency.

The tradeoff is important behavior in reviewed SQL, requiring fresh/populated migration tests, rollback/race/deadline/replay coverage and deliberate portability work. Never depend on unspecified trigger ordering or infer new business policy from a constraint.

## Supersession and boundaries

No superseding decision. [Database contract](../database.md) captures implemented safeguards and current files; historical pre-hardening findings remain in the archive. Arrival/no-show, detailed occupancy, support/provider/retention and commercial limits were not settled by this approval.
