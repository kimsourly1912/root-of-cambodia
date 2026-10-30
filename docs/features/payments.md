# Property payment records

**Status:** implemented locally; money is handled outside the platform.

**Responsible role:** project owner (business rules); maintainer (delivery).

**Last source verification:** 30 October 2026; feat/property-payment-records stacked on stay PR #27.

**Sources:** [selected rules and authority](../product/stay-operations.md), [bookings](bookings.md), [database invariants](../architecture/database.md), [service](../../packages/backend/src/payments.ts), [named persistence](../../packages/backend/src/payment-persistence.ts), [private queries](../../packages/backend/src/payment-queries.ts), [0016](../../packages/backend/migrations/0016_property_payment_records.sql).

## Meaning and permissions

A current verified property owner may attest that the full immutable booked USD total was received externally, only after the stay is Checked-in or Completed. This is property bookkeeping, not money collection or independent payment verification. No record means **Payment not recorded**, not actual nonpayment. Zero-total stays say **No payment due** and cannot create a money-received event. The app records its database timestamp as **Recorded at**; it does not invent when real money changed hands.

An owner can void a mistaken active record with a required private correction reason. Both events remain attributable and immutable. Voiding does not refund money, claim a new debt or erase the original event. A later replacement is a separate deliberate operation. Only one active full-payment record exists per booking; revisions prevent a stale review from correcting or replacing a newer record. Partial payments, deposits, exchange rates, overpayments, fees, settlements, processor receipts and refunds are outside this contract.

Booking and payment state are independent. Completion is available without a payment record; payment operations change no booking state, booked dates, inventory, allocations, terms or price. Existing paused-property bookings retain these owner actions. External reservations do not acquire a fictional guest identity. No new payment email is sent.

## Private routes and recovery

All routes require the existing verified session. Mutations retain same-origin validation and bounded JSON handling; successes and errors are private/no-store. Wrong-property/account access returns 404. Routes stay thin and call shared services.

| Route | Purpose |
| --- | --- |
| GET /api/owner/bookings/:id/payments?cursor= | Current summary, latest 20 events plus older-history cursor, up to five unfinished saved reviews |
| POST /api/owner/bookings/:id/payments/attempts/:attemptId | Save an immutable owner-bound review with action record/void and the expected nonnegative revision; void requires reason |
| GET /api/owner/bookings/:id/payments/attempts/:attemptId | Recover that owner's saved review and original successful receipt |
| POST /api/owner/bookings/:id/payments/attempts/:attemptId/apply | Apply the exact saved body using payment:attemptId as the operation key |

Attempt IDs are UUIDs. Clients cannot choose an amount, currency, booking status, actor or payment time. Unknown fields, invalid revisions and blank/oversized correction reasons are rejected. Revision/state conflicts require a reload and deliberate fresh review; an uncertain response retries the same attempt. A successful original receipt remains recoverable after later corrections, but current ownership/verification is still required.

The owner detail page uses an explicit attestation, server-saved review and final apply action. Its recovery URL contains only an opaque attempt ID. Private reason/body data is not stored in browser persistence. If saving a review has an uncertain outcome, the owner checks that saved review before preparing another; preparing never records or voids money. If apply is interrupted, reopening the same review recovers the receipt and redirects to the current booking. No automatic fresh payment operation is created.

## Privacy, consistency and verification

The owner sees bounded revision-ordered history and private correction reasons. The booking guest sees only their own status, full amount when recorded, recorded-at and latest-change timestamps. Guest DTOs and HTML omit correction reasons, ledger actor/operation IDs, attempts and private owner history. Email verification does not prove that money was received.

The ledger event, projection and original receipt commit in one D1 batch. Triggers recheck current verified ownership, the exact immutable positive USD total, correct action/state, sequential revision and active correction target. Event/projection/receipt failures roll the entire operation back. Replays preserve the original result without adding events. Technical history immutability preserves correctness; legal retention/erasure remains an open release decision.

Native D1 tests exercise contention, rollback, stale reviews, access changes, immutable history, bounded pagination, zero totals, guest privacy and a populated 0015 upgrade. Built-Worker and matching desktop/phone journeys cover the real private endpoints, full record, interrupted apply/reload recovery, correction and completion without a record. Exact commands, commits and results belong in [status](../status.md) and the PR; local emulation is not live financial or release evidence.
