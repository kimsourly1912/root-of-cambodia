# Booking and inventory contract

**Status:** implemented API/database foundation; guest/owner booking screens planned; arrival blocked.

**Responsible role:** booking maintainer; project owner for policy (responsibility, not an assigned person).

**Last source verification:** 29 October 2026, [607a705](https://github.com/kimsourly1912/root-of-cambodia/commit/607a7057b908a005f9f3529141b0978f52d24ce0).

**Sources:** [apps/web/app/api/booking-quotes/route.ts](../../apps/web/app/api/booking-quotes/route.ts), [apps/web/app/api/bookings/](../../apps/web/app/api/bookings), [apps/web/app/api/external-reservations/route.ts](../../apps/web/app/api/external-reservations/route.ts), [apps/web/app/api/inventory/route.ts](../../apps/web/app/api/inventory/route.ts), [packages/backend/src/bookings.ts](../../packages/backend/src/bookings.ts), [packages/backend/src/quotes.ts](../../packages/backend/src/quotes.ts), [packages/backend/src/booking-persistence.ts](../../packages/backend/src/booking-persistence.ts), [packages/backend/src/access.ts](../../packages/backend/src/access.ts).

## Policy, actors and non-goals

[Accepted scope](../product/scope.md) governs request-to-book, pay-at-property USD prices, 12-hour owner response, at least 24-hour lead time, immutable submitted price/terms and free guest cancellation before scheduled check-in. Pending holds no stock. Current APIs do not constitute public discovery or complete booking screens. No payment processing, no-show workflow, admin impersonation or late-arrival rule is implemented.

Verified guests submit online requests and read/cancel their own bookings. Verified owners read/respond/cancel/complete bookings for their own properties and use owner-only external reservations/inventory edits. System expiry is a trusted internal operation. Missing ownership is normally concealed as 404. No implicit super-admin booking access exists.

## Quote, snapshots and stock

Input is propertyId, checkin/checkout ISO dates, termsVersion and distinct room lines containing roomId, quantity, adults, children. Server checks online published property/active rooms, terms, every occupied-night rate/stock and aggregate adult/child/total capacity. Infants explicitly return infant_policy_decision_required; age/distribution policy remains D02.

Current engineering bounds: 1–10 room lines, quantity 1–100, adults 1–10,000 and children 0–10,000 per line, at most 366 nights and 60 line/night rows, max 20 per-stay charges; unit-night/charge max 100,000,000 cents and total max 1,000,000,000 cents. These are safeguards, not approved commercial limits. Unique room/date coverage and canonical dates matter, not counts alone.

Quote response includes hash, normalized input, totalCents, USD currency, itemized charges, policy version/text and lines with selections/room names/night prices. Submission requires quoteHash and recalculates server data if no successful matching receipt exists. Changed quote/terms require fresh review; clients never supply authoritative totals/identity.

The transaction snapshots property/guest names and guest email (online), dates, UTC schedule instants/timezone/times, room names/quantities/occupancy/capacities, nightly prices/charges/total and policy/terms/cancellation text. Catalog changes cannot rewrite these. Internal building rows are sealed before exposure.

## Actual routes and responses

| Route | Implemented methods / input | Success |
| --- | --- | --- |
| /api/booking-quotes | POST selection | 200 quote described above |
| /api/bookings | POST selection + quoteHash, Idempotency-Key | 200 receipt id/status=pending; no collection GET |
| /api/bookings/:id | GET verified guest/owner scoped | 200 booking projection plus lines/charges/events; internal building excluded |
| /api/bookings/:id/:action | POST optional reason, Idempotency-Key | 200 receipt for allowed transition; action allowlist below |
| /api/external-reservations | POST selection + preview:true, or selection + quoteHash and Idempotency-Key | Preview 200 hash/totalCents; commit 200 id/status=confirmed |
| /api/inventory | POST roomId/night/capacity/blocked/revision and Idempotency-Key | 200 id/status=updated receipt |

[Route source](../../apps/web/app/api/) is authoritative. The old proposed 202 submission and /api/owner/bookings/... routes are not the current contract. There is no booking-list GET, public place/property API, publication/admin review endpoint or payment-status action.

JSON routes use [http.ts](../../apps/web/src/http.ts): verified session, write Origin/application-json checks, streamed 32 KiB cap, private/no-store and Vary: Cookie. Errors are `{error: code}` with X-Request-Id header, not the old proposed message/field-error/request-ID body. Domain statuses include 401/403/404/409/413/422/503. Better Auth owns its own handler/limiter; common business-action 429 budgets are not implemented.

Representative codes: quote_required/invalid_request/invalid_dates/invalid_occupancy (422), terms_changed/quote_changed/inventory_unavailable/incomplete_rates/booking_conflict/idempotency_conflict (normally 409), not_found (404), owner_reason_required/arrival_policy_decision_required (422), and temporarily_unavailable_retry_same_key (503). Consult [errors.ts](../../packages/backend/src/errors.ts); database refusals may be generic booking_conflict. Unknown action route segments return 404.

## Implemented action and lifecycle boundary

| Action / operation | Actor and current-state/time condition | Result / stock |
| --- | --- | --- |
| Online submit | Verified guest; published property; >=24h before scheduled check-in, rechecked by database time | Pending, expiry at submission +12h; no hold |
| accept | Verified owner; Pending; now strictly before expiry | Confirmed; all nights allocate atomically or whole operation conflicts |
| decline | Verified owner; Pending; now strictly before expiry | Declined; no stock addition |
| System expire | Pending; now >= expiry | Expired; no stock addition |
| cancel_guest | Same verified guest; Pending/Confirmed; now strictly before check-in | Cancelled; committed allocations released once |
| cancel_owner | Verified property owner; Pending/Confirmed; now strictly before check-in; nonblank reason <=2,000 chars | Cancelled with attributable reason/outbox; one-time release |
| check_in | Verified owner access is checked | Always decision-required 422; no arrival transition through service |
| complete | Verified property owner; existing Checked-in | Completed; preserve history; no complete current arrival-to-stay flow |
| External submit | Verified owner, owned property/catalog-priced selection | Immediate Confirmed allocation; anonymous external reservation, not a fabricated guest account |

Optional nonblank reasons are trimmed and capped at 2,000 characters for action calls. The supported service action list is accept, decline, cancel_guest, cancel_owner, check_in and complete. No no-show action exists. The SQL recognizes checked_in but test fixtures/trusted SQL are not approval to bypass the service gate.

Decline/expiry/terminal records cannot be revived. Pending can be cancelled before check-in even if its response deadline has passed and expiry maintenance is delayed; accept/decline still enforce expiry. Delayed Cron never permits late acceptance. Cancellation after scheduled check-in conflicts; contact/support policy remains open.

## Atomicity, external reservations and retries

[Database contract](../architecture/database.md) and [ADR 0002](../architecture/decisions/0002-atomic-booking-operations.md) own all-night allocation, zero-row guards, history/outbox/receipt atomicity and authorization revocation/replay semantics.

External reservations use the same stock invariant and server catalog quote, allocate immediately and have no guest account/contact/negotiated-price contract. Existing inventory edits version an already configured night, allow capacity/blocked changes within bounds and cannot assign reserved. The private weekly calendar additionally creates missing rates/stock; see [owner supply](owner-supply.md).

A matching receipt returns the original successful operation after later state/catalog changes; refresh current authorized booking details. On ambiguous timeout/503, retain the same Idempotency-Key and normalized payload. Never automatically create another request/key. A definite price/state refusal needs explicit review/new attempt. Durable guest attempt reconciliation is future UI work.

## Planned UI and acceptance

The [screen brief](../design/screen-brief.md) describes review/request, pending/confirmed/declined/expired/cancelled detail and booking lists as planned screens. Show full price and exact Cambodia-time deadline; distinguish Pending from Confirmed and booking state from payment. Expose loading, session/verification, changed-price/unavailable, stale and uncertain retry states. Mock controls cannot represent a real booking.

Regressions cover last-room and multi-night/room races, missing coverage, rollback, current authorization, exact deadlines/lead time/cancellation cutoff, replay after later changes, immutable quotes and notification recovery. [Testing](../development/testing.md) specifies the layers; [status](../status.md) identifies observed environment evidence.

Arrival/no-show/late cancellation (D01), occupancy/physical-room continuity (D02/D03), external details (D04), support/suspension (D06), delivery/reminders (D07), retention/recovery (D09/D10) and snapshot disclosure (D17) remain open. Completion tests beginning with trusted Checked-in fixtures do not establish a complete app lifecycle.
