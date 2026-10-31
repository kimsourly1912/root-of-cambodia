# Proposed guest request and owner response journey

**Status:** accepted on 30 October 2026; staged implementation tracked in [status](../status.md).

**Responsible role:** project owner (privacy/product decision); maintainer (implementation).

**Last source verification:** 30 October 2026, main [4cf4e14](https://github.com/kimsourly1912/root-of-cambodia/commit/4cf4e1405cd707e1c266b2c893aa274676f74b8c), after merged PR #23.

**Sources:** [accepted scope](scope.md), [open decisions](open-decisions.md), [booking contract](../features/bookings.md), [guest browsing](../features/guest-browsing.md), [architecture](../architecture/overview.md), [atomic booking ADR](../architecture/decisions/0002-atomic-booking-operations.md), [booking reads](../../packages/backend/src/shared/access.ts), [quote implementation](../../packages/backend/src/features/quotes/quotes.ts), [persistence](../../packages/backend/src/features/bookings/booking-persistence.ts), [private logistics](../../packages/backend/src/features/property-logistics/property-logistics-queries.ts), [screen brief](../design/screen-brief.md).

## Where we are and the next outcome

Owner setup, private photos, publication review and anonymous property browsing exist. The booking engine can quote, submit, accept, decline and cancel requests, but guests and owners do not yet have the screens to use those operations. This is still implementation/local verification; staging and pilot readiness are later gates.

Recommend connecting one usable request-to-confirmation journey in two reviewable implementation PRs. Preserve the agreed stack, payment policy and booking rules. Before writing that feature, settle D17: who sees private property logistics, in which states, and which version they receive.

This proposal does not authorize implementation by its mere creation or merge. The current instruction to continue authorizes inspection and this concrete proposal; an explicit agreement with the recommendation is needed for the new disclosure policy. No source, schema, data, provider or deployment behavior changes in this planning PR.

## Recommended D17 decision

Keep anonymous browsing and Pending requests limited to the existing public property information. Reveal exact logistics only to the verified guest whose online booking is Confirmed. Save a separate immutable copy when the owner accepts, using the exact information the owner previews for that acceptance.

| Viewer / booking state | Proposed property logistics visibility |
| --- | --- |
| Anonymous visitor, signed-out account or unrelated guest/owner | None; no private fields in JSON, HTML, client props, lists or images |
| Booking guest, Pending (including overdue Pending awaiting expiry maintenance) | None; explain that address/contact/arrival information becomes available after confirmation |
| Booking guest, Confirmed | Exact address; optional coordinates as text; property contact name and configured phone/email; optional arrival instructions, all from the acceptance copy |
| Booking guest, Declined / Expired / Cancelled | No logistics in subsequent responses; retain booking dates, price, status and appropriate history |
| Booking guest, legacy Checked-in / Completed | Do not add logistics disclosure in this slice; D01 arrival/completion journey remains separate |
| Current verified property owner | Existing access to owned logistics and associated booking details; show the acceptance copy separately where present |
| Pilot publication reviewer / future support admin | No new booking privileges; publication-review access is a separate existing contract |

The guest's name/email already belongs to the private booking record and is available to the responsible property owner for handling the request. Do not publish it or create an anonymous external guest account. A person who is both guest and owner gets only the access applicable to the specific booking/property.

The acceptance copy contains only address, optional coordinates, contact fields and arrival notes, plus attributable version/time evidence. It must not include the owner's account email unless that email was explicitly configured as the property contact. No map/geocoding provider or verification claim is added. Arrival instructions are information; showing them does not enable check-in or settle early/late arrival rules.

Require a nonblank address and at least one property contact method for a new acceptance under this contract. Existing publication already requires these, but legacy or inconsistent data must fail clearly rather than confirm with unusable instructions. The owner sees exactly what will be shared before accepting; a changed preview requires reload/review. This is a proposed acceptance safeguard, not a silently approved new rule.

For a guest, the copy remains available while Confirmed even if the listing is later paused, without requiring public catalog eligibility. Always recheck verified identity, booking ownership and current booking state. Do not add suspension/support access rules. Cancellation hides future responses; it cannot recall downloaded text, screenshots or emails and does not delete retained evidence. Retention/erasure remains D09.

## Why copy details at acceptance

Example: the owner accepts a Kampot stay with the entrance address and contact shown in the acceptance preview. A later edit to the property must not silently replace what that guest was told. Dates, prices and agreed policies remain the existing submission-time snapshot; logistics is a separate acceptance-time copy and never requotes the stay.

| Choice | Effect / tradeoff |
| --- | --- |
| Recommended: reveal after confirmation, copy at acceptance | Keeps private addresses away from unsuccessful requests and gives an attributable, stable set of directions. Adds a small D1 record/migration and acceptance-preview check; no new service/subscription. A later corrections workflow is still needed before permitting logistics changes for upcoming stays. |
| Reveal after confirmation, always read current property details | Less schema work and corrections appear immediately, but old bookings silently change and current revision history cannot reconstruct all earlier field contents. |
| Copy at request submission, reveal after confirmation | Stable but may be out of date by acceptance; captures private details for requests that never confirm. |
| Reveal while Pending or publicly | Lets guests contact/locate a property earlier, but discloses private logistics even when no stay is accepted; changes the agreed public/private boundary. |

Recommend no automatic correction/backfill into a saved acceptance copy. Published logistics editing and a guest-notified correction mechanism remain separate D05/D07 scope. This slice must clearly label when details were saved and honestly show unavailable details for old Confirmed bookings without a copy. Never claim today's values were the historical accepted values, block old receipt recovery, or invent a support/contact channel. Any transition for real legacy stays needs a separately agreed repair plan before pilot use.

## Delivery in two focused slices after agreement

### A. Guest request and tracking

- Add date, room quantity and aggregate adult/child selection from a public stay into a private review/request flow. Keep optional infants/age definitions out of scope; do not invent age bands or infer a zero-infant policy. State aggregate capacity limits without promising one particular physical room throughout the stay.
- Reuse sign-in, verified-email and account-name gates. Anonymous browsing remains available; the current quote API requires verified identity. Preserve the chosen selection across ordinary auth navigation without placing private guest/contact data in URLs.
- Obtain current eligible room/terms context through a scoped backend read. Public review snapshots are descriptive, not live prices or authority to book. Show configured approved terms/version and full itemized server quote, then explicitly accept and request. If actual terms are unconfigured, block with honest guidance; synthetic local terms are only test fixtures.
- Add My bookings and own booking details with bounded pagination and explicit status/date/price/reference. A Pending result must say Pending confirmation, show the exact Cambodia-time response deadline and explain that no room is held. Show $0 due now and pay at property.
- Connect existing guest cancellation before scheduled check-in, with confirmation and honest conflicts. Present Declined, Expired and Cancelled states with an explicit return to search/new request. Do not silently recycle a request.
- During this intermediate PR, existing Confirmed bookings may show the agreed unavailable-logistics state until slice B supplies acceptance copies. Do not describe A alone as a complete confirmation journey.

### B. Owner response and confirmed logistics

- Add a property-scoped booking list and details reachable from owner navigation. Show guest name/email privately, dates, rooms, full submitted price, response deadline and history.
- Connect accept/decline and existing pre-check-in owner cancellation with a required cancellation reason. Accept requires the exact logistics preview plus the existing all-night stock/deadline/ownership checks. Display inventory/state conflicts clearly; never show confirmation before server success.
- Add the accepted D17 state-specific projection and immutable acceptance copy. Existing bookings remain readable when a listing is paused. Guest details show the copy only under the approved state/access rules.
- Keep legacy receipt replay and existing immutable booking records intact. Do not retrofit copies into earlier accepted bookings or change external-reservation rules in this slice. External entry, arrival, payment recording, completion and broad admin/support screens remain later work.

Both slices need loading, empty, session-expired, unverified, unavailable, price/terms-changed, stale-state and uncertain-outcome states on desktop and phone. An overdue Pending request must not offer acceptance or imply that it is Confirmed; system expiry remains authoritative and delayed maintenance must not extend the response deadline.

## Architecture and consistency

Keep one Next.js/shadcn UI app and the existing Workers adapters/shared TypeScript backend/D1. Pages/routes handle presentation/session/transport, authorized queries own private projections, services own intent/validation, and named persistence owns complete atomic operations. This is not a new API server, database, ORM or background service.

New booking-list reads must be bounded, indexed, scoped to the verified guest or current property owner and omit internal fields. The current `/api/bookings` has no collection GET; choose and document its concrete collection contract during implementation. Reuse the existing detail/action routes where appropriate. Keep all booking JSON/HTML uncached and exclude private content from logs/errors.

The current quote result includes internal property/user objects; use an explicit browser-safe quote projection rather than passing it wholesale into new client components. Derive actor, authoritative prices, current terms and eligibility on the server. Resolve any difference between the reviewed public room list and current bookable rooms explicitly. Never fall back to arbitrary property/room IDs merely because they exist.

For slice B, use an additive ordered migration, preserving migrations 0001–0012. The acceptance copy, transition, every inventory allocation, required history/outbox and success receipt must commit together. Fence owner identity, current logistics revisions and displayed content at commit. Failure on any later night or snapshot write must roll back the whole acceptance. A retry with the original successful key/payload returns its original receipt; it must not capture new logistics or repeat allocation.

Retain an account-bound attempt identity and reconcile uncertain results against authorized server records. Preserve the same key and normalized payload for a timeout/503/lost-response retry, including after navigation/auth recovery; never automatically mint a replacement attempt. Specify and test the reconciliation transport during implementation. Do not store private booking payloads in persistent browser storage or invent a new receipt-retention rule. Successful receipt recovery must refresh the currently authorized booking state.

No new provider or subscription is proposed. D1 storage/reads increase modestly for the copy and bounded lists; real usage, indexes and existing abuse budgets still need verification before launch. Reuse durable notification events; no new live email integration or message containing private logistics is authorized here.

## Verification and compatibility criteria

1. Preserve all existing native Vitest booking/publication/catalog regressions. Add list scope/pagination/ownership tests, safe quote projection, private-field absence and state-specific logistics tests across API, SSR and client data.
2. Prove changed quote/terms review, exact 24-hour submission and 12-hour response boundaries, pre-check-in cancellation, overdue Pending display, last-room/multi-night races, double-clicks, lost responses, auth recovery and same-key reconciliation. UI clocks are guidance; database time remains authoritative.
3. For B, prove acceptance snapshot/revision races, rollback on snapshot/history/outbox failure, guest/owner mismatch, terminal-state hiding, paused listing access, legacy Confirmed-without-copy behavior and replay of old successful receipts without backfill.
4. Verify fresh migrations and populated 0012 upgrades preserve bookings, allocations, history, outbox and operation receipts. No destructive migration, synthetic historical evidence or silent terms replacement.
5. Run the pinned frozen pnpm install, types, both Worker builds, full relevant Vitest/built-Worker checks and matching-browser desktop/phone journeys for each implementation tree. Add appropriate keyboard/focus and long Khmer/Latin layout review; record actual limits.
6. Use only fictional local accounts/data and capture/emulation providers. Real email, HTTPS/service permissions, operating budgets, retention/recovery, Khmer usability, accessibility and staging/pilot verification remain [release gates](../operations/release-and-recovery.md).

## Approval record and next action

The requested decision is the recommended D17 matrix and acceptance-time copy, the new acceptance completeness/preview safeguard, honest legacy unavailable behavior and the two-slice local implementation scope above. After explicit agreement, record approval provenance, add the architecture decision/updated contracts and implement slice A first on a separate branch.

D01 arrival/no-show/late cancellation, D02 age/infants, D03 physical-room continuity, D04 external details, D05 published editing/corrections, D06 support/suspension, D07 live delivery, D09 retention and all release approvals remain unresolved. No merge, deployment, remote migration, spend, new provider or repository-setting change is authorized by this proposal.

The project owner replied “Ok” to the explicit plan/privacy agreement question, then instructed: “Please continue to finish this one and also when done this one you can start next and if have any decision please follow your suggestion I all accept and agree.” This accepts the recommended D17 matrix, acceptance-time copy and preview/completeness/legacy safeguards, and authorizes both local implementation slices in sequence. References to proposed choices above preserve the reviewed rationale; this approval record governs their status. It does not approve actual legal text, live service setup, spending, deployment or unrelated unresolved product rules. PR #24 remains an unmerged planning dependency; implementation branches/PRs stay independently reviewable.
