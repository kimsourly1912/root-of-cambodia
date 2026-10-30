# ADR 0007: Owner listing visibility and reviewed offline corrections

**Status:** accepted, 30 October 2026; implementation staged in separate PRs.
**Responsible role:** project owner (publication policy); maintainer (implementation).
**Last source verification:** main 42e8c294cacc3a1658d2447cfb8825d9305a911a.
**Sources:** [accepted recommendation/alternatives/approval](../../product/published-listing-controls-proposal.md), [public boundary](0005-public-listing-boundary.md), [atomic operations](0002-atomic-booking-operations.md), [private booking copies](0006-booking-journey.md).

The owner replied “ok agree you can start all of them” to the concrete two-stage agreement question. Implement unchanged-approval owner pause/resume first, then explicit offline corrections through existing draft editors and a new acknowledged/manual review. A parallel live draft would need additional catalog versioning and switching of room/media/rate references; the pilot accepts being offline during corrections to reuse one catalog.

Preserve the modular Next.js/shared-backend/single-D1 architecture. Use an immutable indexed per-property listing-control event ledger with monotonic revision, actor, prior/latest review identity, action/from/to state and operation reference. Reuse existing owner operation key/fingerprint/receipt recovery. Current publication stays in place; a second mutable control projection is unnecessary. Named persistence owns one atomic save; event guards validate current actor/state/review/sequence, its effect updates publication and a receipt guard requires the matching event.

Resume requires the immediately preceding owner pause and the same current approved evidence, valid public digest/terms and ready approved-media metadata. Unknown historical pauses have no fabricated control events. Calendar age, stock saturation or reviewer reassignment are not new revocation rules. Keep shared public eligibility predicates; the public read contract itself does not expand.

A later review/approval changes the request identity. Control revisions plus that identity and exact desired-state commands fence old tabs. Old successful receipt replay returns its original outcome without applying it again; services recheck current owner access. Definite conflicts require reload. Uncertain actions preserve the key/body in the open tab; navigation loses an unsent intent, with no browser-persistent private payload or durable-recovery claim.

Stage B ends direct Resume when the owner explicitly starts corrections. Preserve property/room/booking identities, immutable review history, submitted price/terms/policy snapshots and Confirmed acceptance logistics. Edits remain offline until new public-display acknowledgement and manual approval. Existing booking actions remain subject to their original rules, with no automatic cancellation or stock release. Corrected logistics do not silently rewrite or notify existing Confirmed guests.

Add ordered migrations and prove fresh/populated upgrades and receipt compatibility. No general publication-state endpoint, support/moderation powers, retention cleanup, provider/cost or deployment choice follows. Exact stage outcomes and environment limits belong in [status](../../status.md) and their PRs.
