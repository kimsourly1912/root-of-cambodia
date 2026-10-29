# ADR 0006: Recoverable booking screens and confirmed private logistics

**Status:** accepted; implementation delivered in guest and owner slices.

**Responsible role:** project owner (product/privacy); maintainer (implementation).

**Last source verification:** 30 October 2026, planning baseline [84eeb66](https://github.com/kimsourly1912/root-of-cambodia/commit/84eeb66309c18f27f4cf851e5282364a14dec777).

**Sources:** [accepted journey and alternatives](../../product/booking-journey-proposal.md), [booking contract](../../features/bookings.md), [atomic writes](0002-atomic-booking-operations.md), [public boundary](0005-public-listing-boundary.md).

## Authority and decision

The owner replied “Ok” to the explicit plan/privacy question and then authorized finishing guest screens and continuing with owner responses, accepting the stated recommendations. This accepts the concrete D17 matrix and local two-slice implementation. No merge is used as evidence of policy approval.

Keep the existing Next.js/shadcn app, Workers adapters and framework-independent backend/D1. Guest pages get bounded, identity-scoped read projections. Existing business operations remain the booking authority; new UI must not calculate authoritative prices or stock.

Save an immutable account-bound review on the server before final submission. Its opaque ID survives navigation/auth recovery in the URL; it is not an authorization credential. No guest payload is stored in persistent browser storage. The stored normalized selection/quote hash produces the same operation key on every send/retry. Server receipt lookup resolves successful lost responses before checking today's catalog; a definite quote refusal requires explicit fresh review. Preparing a review never sends a booking.

The guest sees the exact immutable configured terms document/version alongside house rules, price and accepted cancellation rules before explicit submission. An unset text/version fails closed. Trusted local provisioning accepts already approved text only; no fabricated legal terms, automatic version replacement or public terms editor is introduced. Documents/reviews remain retained under current constraints; retention/erasure is still D09.

D17: expose address, optional coordinates, configured property contact and arrival notes only to the verified guest on a Confirmed online booking. The owner previews the exact copy when accepting; save the copy, state, allocations, history/outbox and success receipt atomically. Fence changed versions/ownership/content. Require address plus one contact method for new acceptance. Existing submitted prices/terms remain immutable and unaffected.

Hide logistics for Pending, Declined, Expired, Cancelled and legacy Checked-in/Completed guest reads. Owners retain scoped property/booking access. Pausing must preserve authorized existing Confirmed reads. Old Confirmed bookings without a copy honestly show unavailable details; no backfill, invented historic values or successful-receipt replacement. Later corrections need deliberate D05/D07 work, and hiding a subsequent response cannot recall copied/downloaded content.

## Alternatives and consequences

Always-live logistics costs less schema work but changes old instructions silently; submission-time copies can already be stale when accepted. Earlier/public disclosure exposes addresses without a confirmed stay. Acceptance-time copying adds one small record and atomic fencing with no new vendor. Current versus saved values must be distinguishable for owners; the correction workflow remains separate.

Browser-only attempt memory loses retry identity on reload; persistent private payloads add privacy/retention risk. Server-saved reviews add bounded storage/read work, but preserve a reviewable same-attempt recovery path. No general draft manager, payment flow or extra backend service is created.

## Delivery boundary

Guest request/tracking/cancellation is slice A. Owner response and the D17 acceptance copy is slice B; A alone is not a complete confirmation journey. [Status](../../status.md) records actual source/tests and remaining gaps. Arrival/no-show, infants/age bands, physical-room continuity, external details, privileged support, published corrections, live providers, budgets, recovery and release remain separate decisions/gates.
