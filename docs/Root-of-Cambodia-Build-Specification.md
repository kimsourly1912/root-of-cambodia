# Root of Cambodia — Initial Build Specification

Implementation update (28 October 2026): the [backend foundation review](Root-of-Cambodia-Backend-Foundation-Review.md) records the new application migrations/services, 24 D1 tests, 12 built-Worker checks, and unresolved release gates. Earlier proof results below are historical; no production verification or deployment is implied.

Date: 28 October 2026

Status: Feature/build contract based on the agreed product scope. The [approved architecture](Root-of-Cambodia-Architecture.md) now governs overall structure; application/ contains a locally tested backend foundation. This draft still includes unimplemented flows and unresolved policies, and does not certify production readiness.

## 1. Architecture contract

- One Next.js full-stack codebase with guest, owner, and super-admin areas.
- Upstream Next.js deployed through an explicitly configured, compatible OpenNext adapter.
- Next.js Route Handlers and server entrypoints call shared business services.
- A small jobs Worker shares contracts and persistence operations; it does not duplicate booking rules.
- D1 is authoritative for identity, ownership, bookings, nightly stock, and durable notification events.
- Better Auth supplies email/password, verified email, and secure sessions.
- shadcn/ui components are maintained in the repository and styled using shared Tailwind tokens.
- R2 stores media; a deliberate Images integration handles variants.
- In-app records plus email are the initial communication channels.
- No payment processing, phone verification, external booking synchronization, or separate guest/owner backends.

The fixture uses native D1 for the critical atomic transition and verifies Drizzle's D1 read path. Using Drizzle does not replace database invariants.

## 2. Domain model

| Entity | Main fields and constraints | Ownership / indexing |
| --- | --- | --- |
| Auth user/session/account/verification | Generated from the selected Better Auth configuration | Auth indexes and unique email/token constraints |
| Owner profile | User reference, onboarding state, business/display contact | One initial owner profile per account |
| Place | Category, province, normalized Khmer/English name, coordinates, publication state | Province/category/publication indexes |
| Property | Place reference, owner reference, facilities, arrival times, timezone, policy version | Owner and publication indexes |
| Room type | Property reference, description, capacity, unit quantity, active state | Property index; a unique unit has quantity one |
| Inventory night | Room type, local stay date, capacity, blocked and reserved quantities | Unique room-type/date key; nonnegative values; blocked + reserved <= capacity |
| Nightly rate | Room type, local date, USD cents, revision | Unique room-type/date key |
| Booking | Guest/property, state, request/expiry times, local dates and check-in instant, immutable total and policy snapshot | Guest/date, property/state/date, state/expiry indexes |
| Booking room line | Booking, room type, quantity, occupancy snapshot | Stable line identity; property consistency |
| Booking nightly quote | Booking line/date, quantity, unit price and charges | Immutable submitted quote and complete date coverage |
| Allocation | Booking line, room type/date, reserved quantity, release marker | Unique allocation key; never release twice |
| Booking event | Booking, actor or system, event kind, time, operation ID | Append-only history; stable unique event IDs |
| Notification outbox | Event ID, kind, recipient reference, due time, dispatch state | Unique event/channel; state/due index |
| Delivery attempt | Outbox reference, provider ID, result, attempt count, next retry | Failure and retry indexes; no token/plaintext guest notes in logs |
| Media asset | Owner/property, controlled object keys, format/dimensions, processing/publication state | Owner/property and cleanup indexes |
| Saved place / report | User/place uniqueness; report status and reason | User/place and review-queue indexes |

The booking foundation subset is now expressed in application/migrations/ with local schema/upgrade tests; see the backend review for coverage and limits. Remaining product entities and operational policies still need implementation/review. The historical fixture SQL intentionally implements only a small subset.

The [schema review](Root-of-Cambodia-Schema-Review.md) records the follow-up proof safeguards and unresolved production work. The [Claude mockup brief](Claude-Mockup-Brief.md) translates the product rules into screen flows and states.

Dates are local ISO calendar dates for occupied nights. Events and deadlines use explicit UTC instants. All property-time interpretation uses Asia/Phnom_Penh. Monetary totals use integer USD cents.

## 3. Booking rules and state changes

| Operation | Preconditions | Result |
| --- | --- | --- |
| Submit | Verified account; suitable published property and room; valid occupancy/dates; at least 24 hours before scheduled check-in; server-generated quote | Pending, expiry = authoritative submission time + 12 hours, no inventory hold |
| Accept | Verified owner of the property; Pending; current time strictly before expiry; all requested nights available | Atomic confirmation, allocations, history, outbox |
| Decline | Verified owner; Pending and not expired | Declined; history/outbox; no stock change |
| Expire | System; Pending and current time >= expiry | Expired; history/outbox; no stock change |
| Guest cancel | Guest owns booking; Pending or Confirmed; before check-in | Cancelled; release committed allocations once; history/outbox |
| Owner cancel | Property owner; permitted current state; required reason | Cancelled with attributable reason; release once; notify guest |
| Check in | Property owner; Confirmed; arrival policy satisfied | Checked in; no second allocation |
| Complete | Property owner; Checked in | Completed; retain occupied-night history |
| No-show | Property owner; Confirmed; agreed arrival cutoff reached | No-show under a documented release/notification policy |

Owner cancellation timing after check-in, no-show cutoff, and late-arrival handling remain policy decisions. Do not infer those from the fixture's limited cancellation function.

Pausing a property prevents new requests while retaining existing booking actions. Account suspension must not silently cancel stays; support access and affected-booking handling need a written procedure.

### Atomicity contract

- No read/check/write sequence spread across independently committed calls.
- The confirmed transition, all-night allocation, history, and outbox commit together.
- Missing inventory, invalid property/room relation, incomplete quote coverage, or insufficient capacity aborts the operation.
- Build the submitted quote header, stable room lines, nightly rows, charges, occupancy, and policy snapshot in one atomic creation operation. Seal it before exposing the request; later changes require a new request.
- Require every room line to cover exactly the local dates from check-in through the night before checkout, with a consistent requested quantity. Do not validate coverage by counting rows alone.
- Reconcile integer nightly amounts and mandatory charges to the submitted total. Enforce bounded integer quantities and money at the service and database boundaries.
- Reject unsupported state transitions and direct inserts that bypass allocation. Retain the actor, role, time, and required owner cancellation reason as immutable history.
- A zero-row transition cannot be followed by unconditional side effects.
- Cancellation releases only existing unreleased allocations.
- SQL constraints protect stock even during external booking entry, maintenance blocking, and capacity reduction.
- Acceptance checks current database time and state; a delayed cron does not permit late acceptance.
- All mutations in one operation remain in one D1 database.
- The proof's triggers are a validated candidate for the critical transition, not a full production booking engine.

Room-type quantities need pilot validation for continuous physical-room availability across multi-night stays.

## 4. Access matrix

| Capability | Public visitor | Verified guest | Verified property owner | Super admin |
| --- | --- | --- | --- | --- |
| Read public approved listings | Yes | Yes | Yes | Yes |
| Save places | No | Own list | Own list | Own list |
| Request accommodation | No | Yes | As guest | As guest, if supported |
| Read booking details | No | Own bookings | Bookings for owned property | Operationally authorized support access |
| Accept/decline a request | No | No | Owned property only | No routine owner impersonation |
| Change room prices / inventory | No | No | Owned property only | No routine business operation |
| Edit property/photos | No | No | Owned property only | Moderation actions under a distinct policy |
| Review first-property publication | No | No | Submit / correct own draft | Yes |
| Restrict accounts / manage reports | No | Report own issue | Report relevant issue | Authorized role, audited |

An unverified account can access verification/recovery flows. The proposed email/password configuration rejects unverified login; no application booking access is granted by merely submitting registration.

Never accept owner IDs, roles, verification flags, quote totals, or current booking states from the client as authorization evidence. The server derives identity from the session and checks ownership on every operation. Hiding a button or protecting a layout is not authorization.

Guest contact details are private and limited to the responsible property and authorized support use.

## 5. Initial API contract

The following routes are proposed application contracts. Fixture routes are narrower and must not be treated as a completed public API.

| Method / route | Behavior | Typical result |
| --- | --- | --- |
| GET /api/places | Published listings with bounded filters/pagination | 200 |
| GET /api/properties/:id | Published property/room details | 200 or 404 |
| POST /api/booking-quotes | Recalculate dates, occupancy, nightly prices, mandatory charges | 200 or 422 |
| POST /api/bookings | Validate quote and create immutable request | 202 Pending |
| GET /api/bookings | Guest's own bookings | 200 |
| GET /api/bookings/:id | Authorized guest / property owner / support view | 200 or 404 |
| POST /api/bookings/:id/cancel | Authorized cancellation under captured policy | 200 or 409 |
| POST /api/owner/bookings/:id/accept | Owner's atomic confirmation | 200 or 409 |
| POST /api/owner/bookings/:id/decline | Owner response | 200 or 409 |
| POST /api/owner/properties | Create owned property draft | 201 |
| PATCH /api/owner/properties/:id | Versioned owner edit | 200 or 409 |
| PUT /api/owner/room-types/:id/inventory | Bounded dated inventory changes using invariant checks | 200 or 409 |
| POST /api/owner/external-bookings | Allocate a reservation received elsewhere | 201 or 409 |
| POST /api/admin/properties/:id/review | Authorized publication decision with history | 200 or 409 |

Better Auth owns its supported auth endpoints; use its client/handler contracts rather than duplicating authentication APIs.

Error contract: stable code, a safe human-readable message, request ID, and field errors where relevant. Use 401 for missing authentication, 403 for a permitted-to-identify but forbidden operation, 404 where ownership should remain undisclosed, 409 for current-state/inventory conflicts, 422 for invalid input, and 429 with Retry-After for rate limits.

Mutations need bounded payloads, authoritative validation, origin/CSRF protection appropriate to their entrypoint, and no-store responses. Server Actions, if used, call the same services and perform their own authorization.

### Retry contract

An idempotency key is scoped to actor + operation and records a request fingerprint. Replay of the same operation returns its stable outcome; reuse with different input returns a conflict. State transitions and unique allocation/event keys remain the final guard.

Do not automatically retry a booking mutation after an ambiguous timeout without its idempotency key and a way to query the existing outcome.

## 6. Notifications and infrastructure

- Commit the business event and outbox row together.
- After commit, queue the event ID; scheduled recovery handles missed publish.
- Consumers deduplicate and record attempts, retry/backoff, and terminal failure.
- Email failure does not undo a valid booking.
- Keep verification/reset tokens out of general booking events and logs.
- Separate local, staging, and production D1/R2/queue/auth configurations.
- No production migration on a normal HTTP request.
- Pin compatible runtime/package versions and keep one deployment path.
- Configure database recovery, independent retained exports, and a restore drill.
- Monitor request failures, database latency/conflicts, expiry, outbox lag, delivery failures, storage growth, and provider spend.

Full email deliverability, queue delivery, media validation/optimization, maps, backup restoration, and production latency still require their own tests. Do not infer them from the successful local auth/D1 proof.

## 7. Remaining operational choices

These remain explicitly open:

- No-show and late-arrival timing; owner cancellation handling after check-in.
- Review rules for additional properties and high-impact edits.
- Recovery/support actions for suspended owners with upcoming stays.
- Adult/child/infant occupancy details and maximum request/stay sizes.
- Email provider and domain, recovery/email-change policy, reminder timing.
- Pilot operating budget, first owners/properties, and recovery targets.
- Actual Khmer search strategy and geographical data maintenance.
- Privacy/support/retention policies and responsibility for discovery listings.

These do not require new product categories; they make the existing scope operable.

## 8. Implementation order

1. Finalize and test the D1 migrations, full quote/date model, and operation guards.
2. Build identity/owner setup, property review, rooms, rates, and availability.
3. Build public accommodation search/details and guest request/review.
4. Add owner responses, cancellation, arrivals, and reliable delivery.
5. Add platform review/support/monitoring and run a controlled pilot.
6. Expand other place categories after validating accommodation operations.

Screen wireframes should follow the operations above and include verification, empty, loading, expired, unavailable, cancellation, and delivery-failure states.
