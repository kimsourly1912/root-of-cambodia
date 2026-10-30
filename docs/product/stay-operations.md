# Arrival, completion and property payment records

**Status:** selected recommendations under the project owner's delegated decision authority; delivered in two focused local slices.

**Responsible role:** project owner (business scope); maintainer (implementation).

**Last source verification:** 30 October 2026; main b9392de14d27e63d472c421f2d8701b54d8dab80 after PRs #24–#26.

**Sources:** [accepted scope](scope.md), [open decisions](open-decisions.md), [booking contract](../features/bookings.md), [atomic architecture](../architecture/decisions/0002-atomic-booking-operations.md), [private disclosure](../architecture/decisions/0006-booking-journey.md).

## Authority and architecture review

The project owner instructed: “when done this one you can start next and if have any decision please follow your suggestion I all accept and agree,” then requested merging the completed PRs and starting two more steps. This is delegated authority to select and implement the stated recommendations within these two local steps. It is not a claim that the owner separately chose every numeric rule, or that a merge itself approves policy. The recommendations were explained before implementation; the choices and limits are recorded here.

Keep the existing Next.js/shadcn app, verified Better Auth identities, shared typed backend and named atomic D1 operations. Do not add another service, library, payment processor, provider, subscription or deployment. Owners act only for currently owned properties; guests see only their own records. Existing immutable prices/terms/dates, stock, receipt recovery and privacy rules remain authoritative.

## Step 1: owner-attested arrival and completion

- A current verified owner may record Confirmed → Checked-in only at or after the snapshotted scheduled check-in instant and strictly before the snapshotted scheduled checkout instant. Database time decides both exact boundaries. The owner explicitly reports that the guest is physically present; email verification is not proof of arrival.
- A current verified owner may mark Checked-in → Completed when the guest has left, including an early departure. It does not automatically change the booked dates, quoted price, payment record or reserved nights. Completion does not imply payment.
- Keep the original pre-check-in guest/owner cancellation cutoff. Do not enable post-check-in cancellation, early check-in overrides, after-checkout arrival overrides, no-show decisions, automatic completion, refunds or fees. A booking never automatically becomes a no-show because an arrival is unrecorded.
- Pausing a listing preserves existing stay actions. External reservations use the same owner actions, without fabricating guest identities/contact.
- Keep D17: only Confirmed guests see the saved logistics copy. Checked-in/Completed guest responses still omit it. Later changes to this disclosure need a deliberate decision.
- Preserve same-key/payload retries and original successful receipts after later time/state changes. Store only an opaque attempt ID and the nonsensitive action in the recovery URL; body remains empty, with no private browser payload. Recheck current access on every recovery.

Alternative: keep check-in entirely blocked until every exception is resolved. That is smaller but leaves the ordinary stay journey unusable. Early/late overrides or automatic no-show rules add inventory, trust and support questions; they remain separate. The selected narrow schedule window enables the ordinary flow without pretending those exceptions are settled.

## Step 2: full-payment bookkeeping at the property

- The platform moves no money. A current verified owner can record an attestation that the property's full snapshotted USD total was received outside this platform, for a Checked-in or Completed stay.
- The first slice records the full booked amount only. Partial amounts, deposits, overpayments, currency conversion, settlement, chargebacks and refunds are unsupported; no real-world collection policy is inferred from this narrower interface.
- No record means **Payment not recorded**, not proof that the guest has not paid. A zero-total booking says **No payment due** and does not fabricate a receipt for money collected.
- An owner may void a mistaken record with a required reason, retaining the original record and correction history. Voiding changes the app's bookkeeping; it does not refund money or establish a new debt. A later deliberate replacement record is a new operation.
- Record the app's database timestamp as “Recorded at,” not an invented actual payment time. Do not collect card/bank credentials or create a verified processor receipt. Notes and correction reasons remain owner-private; a guest gets only their own safe payment status, amount and record/correction timestamps.
- Keep payment and booking state independent. Completion does not require a payment record, and payment recording does not check in/complete/cancel a stay or change stock/price. Owner changes are attributable, atomic and recoverable with the same attempt.

Alternative: add partial-payment balances or a processor now. Either introduces more reconciliation, financial-policy and operational scope. Full-attestation bookkeeping is the smallest useful local slice; live money movement remains deferred.

## Verification and remaining gates

Test exact arrival boundaries, concurrent/repeated actions, ownership/verification changes before commit, history/outbox rollback, earlier receipts/data, immutable prices/stock, safe private projections and reload/auth recovery. Payment tests must additionally cover duplicate full records, competing record/void operations, required correction reasons, zero totals and no booking/stock side effects. Use native D1, actual built Workers and desktop/phone browser journeys.

Synthetic test-only clock controls belong in the test harness, never the application or runtime configuration. Staging, actual legal terms, providers, budgets, retention/erasure, recovery ownership, Khmer/manual usability, broader admin/support and unresolved early/late/no-show exceptions remain release or separate product work. The current merge instruction covers existing PRs #24–#26; the two new implementation PRs are for review, with no deployment, remote migration or spending implied.
