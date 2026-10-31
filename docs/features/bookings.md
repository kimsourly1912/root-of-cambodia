# Booking and inventory contract

**Status:** guest request/tracking and owner response/confirmed logistics implemented locally; ordinary arrival/completion added; exceptional handling remains open.

**Responsible role:** booking maintainer; project owner for policy (responsibility, not an assigned person).

**Last source verification:** 30 October 2026; owner-response implementation based on guest PR #25 head [a5bf41f](https://github.com/kimsourly1912/root-of-cambodia/commit/a5bf41ff6d54351358cd307b5ef4b9ded3f9d233).

**Sources:** [apps/web/app/api/booking-quotes/route.ts](../../apps/web/app/api/booking-quotes/route.ts), [apps/web/app/api/bookings/](../../apps/web/app/api/bookings), [apps/web/app/api/external-reservations/route.ts](../../apps/web/app/api/external-reservations/route.ts), [apps/web/app/api/inventory/route.ts](../../apps/web/app/api/inventory/route.ts), [packages/backend/src/features/bookings/bookings.ts](../../packages/backend/src/features/bookings/bookings.ts), [packages/backend/src/features/quotes/quotes.ts](../../packages/backend/src/features/quotes/quotes.ts), [packages/backend/src/features/bookings/booking-persistence.ts](../../packages/backend/src/features/bookings/booking-persistence.ts), [packages/backend/src/shared/access.ts](../../packages/backend/src/shared/access.ts).

## Policy, actors and non-goals

[Accepted scope](../product/scope.md) governs request-to-book, pay-at-property USD prices, 12-hour owner response, at least 24-hour lead time, immutable submitted price/terms and free guest cancellation before scheduled check-in. Pending holds no stock. Public discovery and booking screens now call these shared APIs/services; they do not establish a complete arrival-to-stay lifecycle. No payment processing, no-show workflow, admin impersonation or late-arrival override is implemented. [Full external-payment bookkeeping](payments.md) is a separate owner attestation.

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

[Route source](../../apps/web/app/api/) is authoritative. The old proposed 202 submission and /api/owner/bookings/... routes are not the current contract. The original action API has no booking-list GET, broad admin/support endpoint or payment-status action. Later private journey collection routes are listed below; [property payment records](payments.md) have separate owner endpoints. Separate [guest-browsing APIs](guest-browsing.md) expose only authorized public listing data; they do not enable anonymous quotes, guest booking logistics or mutation access. The narrow [pilot publication review](publication-review.md) endpoints are implemented separately; they are not booking impersonation or general administrative powers.

JSON routes use [http.ts](../../apps/web/server/http.ts): verified session, write Origin/application-json checks, streamed 32 KiB cap, private/no-store and Vary: Cookie. Errors are `{error: code}` with X-Request-Id header, not the old proposed message/field-error/request-ID body. Domain statuses include 401/403/404/409/413/422/503. Better Auth owns its own handler/limiter; common business-action 429 budgets are not implemented.

Representative codes: quote_required/invalid_request/invalid_dates/invalid_occupancy (422), terms_changed/quote_changed/inventory_unavailable/incomplete_rates/booking_conflict/idempotency_conflict (normally 409), not_found (404), owner_reason_required/arrival_policy_decision_required (422), and temporarily_unavailable_retry_same_key (503). Consult [errors.ts](../../packages/backend/src/shared/errors.ts); database refusals may be generic booking_conflict. Unknown action route segments return 404.

## Implemented action and lifecycle boundary

| Action / operation | Actor and current-state/time condition | Result / stock |
| --- | --- | --- |
| Online submit | Verified guest; published property; >=24h before scheduled check-in, rechecked by database time | Pending, expiry at submission +12h; no hold |
| accept | Verified owner; Pending; now strictly before expiry; matching complete logistics preview hash | Confirmed; acceptance copy and all-night allocation commit together or whole operation conflicts |
| decline | Verified owner; Pending; now strictly before expiry | Declined; no stock addition |
| System expire | Pending; now >= expiry | Expired; no stock addition |
| cancel_guest | Same verified guest; Pending/Confirmed; now strictly before check-in | Cancelled; committed allocations released once |
| cancel_owner | Verified property owner; Pending/Confirmed; now strictly before check-in; nonblank reason <=2,000 chars | Cancelled with attributable reason/outbox; one-time release |
| check_in | Current verified owner; Confirmed; scheduled check-in <= database now < scheduled checkout | Checked-in; owner attests physical arrival; stock and quote unchanged |
| complete | Current verified owner; Checked-in; manual report that the guest has left | Completed; retain booked dates/price/allocations and independent payment state |
| External submit | Verified owner, owned property/catalog-priced selection | Immediate Confirmed allocation; anonymous external reservation, not a fabricated guest account |

Optional nonblank reasons are trimmed and capped at 2,000 characters for action calls. The supported service action list is accept, decline, cancel_guest, cancel_owner, check_in and complete. No no-show action exists. The SQL recognizes checked_in but test fixtures/trusted SQL are not approval to bypass the service gate.

Decline/expiry/terminal records cannot be revived. Pending can be cancelled before check-in even if its response deadline has passed and expiry maintenance is delayed; accept/decline still enforce expiry. Delayed Cron never permits late acceptance. Cancellation after scheduled check-in conflicts; contact/support policy remains open.

## Atomicity, external reservations and retries

[Database contract](../architecture/database.md) and [ADR 0002](../architecture/decisions/0002-atomic-booking-operations.md) own all-night allocation, zero-row guards, history/outbox/receipt atomicity and authorization revocation/replay semantics.

External reservations use the same stock invariant and server catalog quote, allocate immediately and have no guest account/contact/negotiated-price contract. Existing inventory edits version an already configured night, allow capacity/blocked changes within bounds and cannot assign reserved. The private weekly calendar additionally creates missing rates/stock; see [owner supply](owner-supply.md).

A matching receipt returns the original successful operation after later state/catalog changes; refresh current authorized booking details. On ambiguous timeout/503, retain the same Idempotency-Key and normalized payload. Never automatically create another request/key. A definite price/state refusal needs explicit review/new attempt. Durable guest attempt reconciliation is future UI work.

## Planned UI and acceptance

The [30 October booking journey](../product/booking-journey-proposal.md#approval-record-and-next-action) is accepted. Guest slice A and owner slice B are implemented locally; their separate PRs and evidence are tracked in status. [ADR 0006](../architecture/decisions/0006-booking-journey.md) records approval and architecture.

The [screen brief](../design/screen-brief.md) describes review/request, pending/confirmed/declined/expired/cancelled detail and booking lists as planned screens. Show full price and exact Cambodia-time deadline; distinguish Pending from Confirmed and booking state from payment. Expose loading, session/verification, changed-price/unavailable, stale and uncertain retry states. Mock controls cannot represent a real booking.

Regressions cover last-room and multi-night/room races, missing coverage, rollback, current authorization, exact deadlines/lead time/cancellation cutoff, replay after later changes, immutable quotes and notification recovery. [Testing](../development/testing.md) specifies the layers; [status](../status.md) identifies observed environment evidence.

Arrival/no-show/late cancellation (D01), occupancy/physical-room continuity (D02/D03), external details (D04), support/suspension (D06), delivery/reminders (D07), retention/recovery (D09/D10) remain open; D17 is accepted and implemented for the stated booking states. Completion tests beginning with trusted Checked-in fixtures do not establish a complete app lifecycle.

## Guest screens and recovery (slice A)

The public stay links to `/stays/:id/request`; verified guests select dates/room quantities and aggregate party counts, then review full nightly/charge totals, configured booking terms and house/cancellation rules at `/bookings/requests/:attemptId`. Explicit submission leads to `/bookings/:id`. `/bookings` lists only the guest's own bookings with bounded cursor pagination and up to five recent unsent saved reviews. Pending never means confirmed or a stock hold. Details show Cambodia-time deadlines and support the existing pre-check-in cancellation action. Arrival/payment recording/owner responses are outside A.

New private/no-store routes, separate from the historical APIs above:

| Route | Method / behavior |
| --- | --- |
| /api/guest/quote | POST existing selection; returns explicit browser-safe quote, itemized rates, terms text/version and house/cancellation policy |
| /api/guest/attempts/:id | POST selection + quoteHash creates/replays an immutable account-bound review; GET returns its safe preview and original successful receipt, if any |
| /api/guest/attempts/:id/send | POST acceptedTerms:true submits exactly the saved selection/hash using guest-request:ID as its stable operation key |
| /api/guest/bookings | GET bounded guest-only collection; optional submitted-time/ID cursor; rejects unknown/repeated query keys |
| /api/guest/bookings/:id | GET guest-only safe detail; no owner/user IDs, raw internal rows or property logistics in slice A |

Preparing/reloading a review never submits it. The opaque attempt UUID is not an authorization credential. Store normalized selection, quote hash, exact safe preview/immutable terms and expected submission fingerprint on the server; private payloads are not persisted in browser storage. Conflicting same-ID payloads fail. The reserved guest-request operation key is atomically fenced to its stored fingerprint even through direct booking APIs. Ambiguous save/send results use the same attempt; a successful receipt redirects to current authorized details after reload/auth recovery, even after cancellation/catalog changes. Definite quote/terms/state refusals require explicit fresh review. Cancellation retains an opaque key in the booking URL and uses the same body/key when retried after lost response or authentication recovery.

Live public eligibility and current room membership/terms are checked for the new quote/request path, with commit-time publication/actor/revision and saved-review/terms guards. Engineering bounds and existing authoritative stock/lead-time/deadline checks remain. Dates/room selection can survive auth navigation in a bounded local return URL; account data/contact/terms content never goes in the URL. Invalid or external return destinations fall back to owner access.

An immutable configured terms document must exist for the property/current selected pilot terms version. A version ID alone does not provide legal text. Missing text blocks new UI requests with a visible unavailable state. The trusted [local terms command](../development/setup.md#local-booking-terms-documents) accepts already approved content only. This work creates no real legal text or live delivery. Migration 0013 adds only empty terms/review tables, indexes and guards; preserves earlier bookings/receipts without backfill. D09 retention remains unresolved.

Slice A initially rendered Confirmed logistics as unavailable. Slice B now implements D17: new acceptance copies are visible only while Confirmed, while older bookings without a copy retain the honest unavailable state. Infants/age definitions remain D02 and unsupported; no zero-infant or commercial age rule is inferred from an adults/children form. Broader post-cutoff support and arrival remain unavailable, rather than linked to an invented support channel.

## Owner response and confirmed logistics (slice B)

Owners use `/owner/properties/:propertyId/bookings` and its `/:bookingId` detail. Lists/details remain available when a listing is paused. Current verified property ownership is checked in scoped reads; a guest, unrelated owner or publication reviewer gains no owner booking access. Details include the submitted price/room/policy snapshots, guest name/email, deadlines and attributable history.

The response form offers only supported current actions: accept/decline before response expiry and owner cancellation before scheduled check-in. Cancellation needs a nonblank reason. Owners preview exact logistics and acknowledge them before preparing acceptance. Preparing a saved response never changes booking state; an explicit apply commits it. Owner response IDs survive reload/auth navigation without putting reasons or private logistics in URLs/browser storage. Uncertain results retain the same saved response/key/payload and recover the original receipt before current preparation checks; reload shows current booking status.

| Route | Implemented behavior |
| --- | --- |
| /api/owner/properties/:id/bookings | GET verified owner-only bounded collection; optional submitted-time/ID cursor |
| /api/owner/bookings/:id/acceptance | GET explicit current logistics preview, readiness and digest/revisions; no public or guest access |
| /api/owner/bookings/:id/attempts/:attemptId | POST action/optional reason/acceptanceHash prepares an immutable scoped response; GET recovers preview/receipt |
| /api/owner/bookings/:id/attempts/:attemptId/apply | POST applies exactly the saved action through the existing atomic booking service |
| /api/bookings/:id/accept | Existing POST now requires acceptanceHash for a new acceptance; earlier successful no-hash receipts still replay unchanged |

Migration 0014 adds acceptance copies and immutable owner response reviews. It backfills neither copies nor approvals. Snapshot insert checks current verified owner, pending/deadline, exact current address/contact/notes/coordinates and versions; the transition requires its matching copy. The named save includes snapshot, stock, history/outbox, receipt and final assertion in one D1 batch. Later-night stock failures, changed versions/ownership/verification or failed history/outbox leave no copy/allocation/success receipt. Reserved owner-response keys are fenced to the saved operation fingerprint even through direct action APIs. Earlier applied migrations remain unchanged.

New guest details perform a final scoped status/snapshot read: logistics is allowlisted and returned only for the booking guest while Confirmed. No internal owner IDs, hashes, versions or operation metadata are included. Pending/Declined/Expired/Cancelled/legacy Checked-in/Completed reads omit it. Pausing does not revoke existing Confirmed access. Owners can distinguish the saved acceptance copy from current details. Subsequent property edits never rewrite the copy. Legacy Confirmed bookings without one remain readable with unavailable details. Hiding future responses cannot recall downloaded content; retention/erasure and later guest-notified corrections remain D09/D05/D07.

Booking updates with the same second timestamp use insertion order as the tie-breaker, so Pending appears before its subsequent response/cancellation. No new arrival/no-show/late-cancellation/payment/completion or privileged support operation is enabled.

## Ordinary stay actions — 30 October 2026

The [selected stay scope](../product/stay-operations.md) partially resolves D01 under the owner's delegated recommendation authority. Owner booking detail now offers schedule-bounded check-in and manual completion, with an explicit physical-arrival/departure attestation. Existing action POSTs use the same atomic transition/history/outbox/receipt boundary. Migration 0015 adds a database-time arrival window guard without changing earlier migrations or backfilling arrival. A valid owner operation outside that window returns booking_conflict (409); the old arrival_policy_decision_required code remains a historical compatibility identifier, not the new normal path.

Opaque stay action/attempt URL parameters preserve identical empty-body retries across reload/auth recovery. A private current-owner receipt query redirects a recovered successful result to current booking details. Client clocks guide controls and refresh periodically; server time/permissions remain decisive. Completion never releases originally booked nights early, recalculates prices or implies payment. Cancellation/no-show/overrides are not extended. D17 still hides guest logistics after check-in. Paused listings retain owned existing booking actions.


## Independent property payment records

Owner booking details now provide the [full-payment bookkeeping contract](payments.md), and guest details render only its safe status/amount/timestamps. Recording or voiding does not transition the stay, release booked nights or recalculate the quote. Completion is allowed without a payment record; “Payment not recorded” never asserts actual nonpayment. The [selected scope](../product/stay-operations.md) explains delegated authority, alternatives and unsupported partial payments/deposits/refunds.

## Saved owner external-reservation journey

The owner booking list links to /owner/properties/:id/bookings/external. Owners choose check-in/checkout and one to ten room selections from a bounded twenty-room page; changing room pages discards unsaved selection. Selection is validated by the existing external catalog quote, with complete nightly rate/stock coverage and aggregate occupancy checks. External bookings keep the existing source behavior, including immediate confirmation/allocation and no online-only 24-hour submission rule. This screen creates neither guest identity/contact nor negotiated prices or legal consent.

Preparing a review stores the current server-selected terms version, exact normalized input, safe itemized preview/hash and operation fingerprint; it allocates nothing. /bookings/external/:attemptId shows rooms/nightly rates/charges/total and saved house rules/terms identifier. An explicit owner acknowledgement applies exactly that review through existing submit(...,"external"). Review/receipt recovery survives reload and sign-in via an opaque ID. Current ownership/verification is checked again on reads/replays and in the atomic booking batch. Successful replay returns the original confirmed receipt after cancellation or catalog changes and redirects to current authorized detail.

| New private route | Contract |
| --- | --- |
| /api/owner/properties/:id/external/attempts/:attemptId | POST checkin/checkout/lines only saves or recovers a same-ID selection review; GET explicit preview/receipt |
| Same path /apply | POST confirmed:true applies the saved review with stable external-request:ID key; false/missing or extra input is refused |

Prepared reviews are immutable and owner-bound. New additive migration 0017 does not backfill earlier bookings or change earlier migrations. It fences the reserved key namespace against a mismatched fingerprint/source even through older direct booking routes. Stock, booking lines/nights/history/outbox and receipt remain one transaction. Preparing uses a separate stored review, as in the accepted guest/owner-response architecture; no partial booking exists at this stage.

An uncertain preparation provides a saved-review lookup; no booking command was sent. An uncertain confirmation retries/reopens the same review. A definite price/settings/stock refusal requires deliberate fresh selection/review. Recent unresolved reviews are bounded to five in the entry screen; older bookmarked IDs remain authorized/readable. No private review payload is stored in browser persistence. Retention/erasure remains D09.

The [two-step scope](../product/owner-inventory-operations.md) retains D02/D03/D04, external guest contact/pricing, physical room assignment, no-show/late cancellation, live terms/providers and release gates. Native tests cover anonymous snapshots, last-room/multi-room rollback, current access, stale quote/reserved-key bypass, replay after cancellation and populated upgrades. Actual Worker/browser results belong in status and the PR.

## Owner booking status filters

The private `/owner/properties/:id/bookings` page and GET `/api/owner/properties/:id/bookings` accept optional `status` and `cursor`. Omitted status or `all` returns the original full collection. Exact supported saved states are pending, confirmed, checked_in, completed, cancelled, declined and expired. Internal building, empty/unknown status and malformed cursors return invalid_request (422 at the API); repeated API parameters and unknown API keys are rejected. Repeated page status/cursor values show the invalid-filter recovery link.

Filtering occurs in the authorized server query before the twenty-row page plus one-row lookahead. Sort remains newest submission first, with descending ID as the equal-time tie-breaker. Older/newest links retain the selected status; selecting another status starts its first page. The cursor is a bounded position, not an authorization token or immutable dataset snapshot: concurrent status changes can move records between lists, and owners may reload latest results. Filters reflect stored state rather than inferring expiry or check-in eligibility from the browser clock. Existing action deadlines and transition guards remain authoritative.

Read access rechecks verified current property ownership, including the final query; paused listings retain existing booking access. Lists keep their existing allowlisted projection and private/no-store response; no guest email, private logistics or internal owner/operation data is added. Empty results name the chosen filter. No date grouping, live counts, reports, search, new status, booking action, bulk mutation or payment rule is introduced.

Additive [0018](../../packages/backend/migrations/0018_owner_booking_list_indexes.sql) adds ordered partial indexes for property/submission and property/status/submission, excluding building. It changes no records or existing schema objects. Native D1 checks cover full-collection filtering, pagination/order, unchanged business data, current access, invalid input, populated 0017 upgrade/replay and EXPLAIN plans of actual first/next-page queries. Built-Worker and desktop/phone journeys cover transport/privacy, navigation, empty/error and cross-owner states. Exact execution evidence belongs in [status](../status.md) and the PR.
