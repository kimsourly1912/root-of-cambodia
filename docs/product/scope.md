# Product scope and accepted rules

**Status:** accepted product direction; delivery tracked in status.

**Responsible role:** project owner (responsibility, not an assigned person).

**Last source verification:** 29 October 2026; guest-browsing implementation based on [ef971f1](https://github.com/kimsourly1912/root-of-cambodia/commit/ef971f1a863c6211a9a55fb1223982327fc5fdf7).

**Sources:** [docs/archive/2026-10/Root-of-Cambodia-Product-Plan.md](../archive/2026-10/Root-of-Cambodia-Product-Plan.md), [docs/archive/2026-10/Root-of-Cambodia-Architecture.md](../archive/2026-10/Root-of-Cambodia-Architecture.md).

This page consolidates the owner-approved product rules. [Status](../status.md) records what exists; approved scope does not imply implementation. [Open decisions](open-decisions.md) records matters still requiring owner approval.

## Audience and scope

Help people living in Cambodia discover selected places across the country and request accommodation directly from participating owners. Begin with selected listings across provinces; do not claim comprehensive national coverage. Khmer-first delivery and Khmer/English place-name search are accepted directions, with copy and usability review still required.

Accommodation is the first complete booking journey: hotels, resorts, guesthouses, bungalows and homestays. Basic restaurants, cafés, attractions and activity listings may support discovery later; reservation workflows for them are deferred. Content ownership must be settled before informational categories launch.

## Accepted policy

| Area | Rule |
| --- | --- |
| Booking | Request-to-book; successful submission means Pending confirmation, requiring owner acceptance |
| Payment | Guest pays the property directly; no platform collection in v1 |
| Currency | USD booking prices; optional Riel display/conversion is undecided |
| Account | A person can be both guest and owner; one owner may manage multiple properties |
| Verification | Signed-in account, guest name, verified email and accepted booking terms; no phone verification |
| Verification meaning | Inbox control, not legal identity or proof of arrival; any phone field is informational |
| Owner access | Owner accounts initially; staff invitations deferred |
| Owner operations | Owners maintain information, rooms, prices, availability and bookings |
| Publication | Verified owner email and first-property review before publication; project owner is the sole pilot listing reviewer (29 October 2026). Narrow procedure in [pilot review](../features/publication-review.md); the [minimum checklist](publication-checklist-proposal.md) was approved on 29 October 2026; broader editing/public delivery policies remain open |
| Anonymous browsing | First [guest-browsing boundary](guest-browsing-proposal.md) approved 29 October 2026: allowlisted approved content, processed gallery/first-photo cover, province only and explicit owner public-display acknowledgement; exact logistics/originals private during browsing; D17 booking-state decision accepted separately |
| Ongoing edits | Owners update information, with moderation/reports available; additional-property and high-impact-edit procedures remain open |
| Response deadline | Accept or decline within 12 hours of submission, otherwise expire; acceptance at/after deadline is rejected even before a sweep runs |
| Lead time | Submit at least 24 hours before the property's scheduled check-in |
| Guest cancellation | Free before scheduled check-in; encourage 24 hours' notice without an automatic fee cutoff |
| Owner cancellation | Required attributable reason and prompt guest notification; late handling remains undecided |
| Changes | No silent edits to submitted dates, room selections or prices; cancel and submit a fresh request |
| Price commitment | Snapshot the complete quoted price, dates, occupancy, rooms, mandatory charges and accepted policies/terms |
| Inventory | Quantities per room type; distinct/unique accommodation can use a separate option with quantity one |
| Holds | Pending requests do not reserve stock; acceptance rechecks and reserves every occupied night atomically |
| Quantity model | Sell rooms or the whole property against given inventory, without overlapping stock sold in both modes |
| Stock | Check capacity, blocked and reserved quantities for every occupied night; checkout consumes no additional night |
| External bookings | Owners record external reservations and maintenance blocks; no channel-manager synchronization |
| Pilot | Free pilot for selected owners; later paid business model remains undecided |

Decline/expiry must not add stock that Pending never reserved. Cancellation releases committed allocations once. Capacity cannot be reduced below blocked plus reserved inventory. Quantity checks cannot see unrecorded bookings elsewhere or prove continuous assignment of one physical room.

## Intended journeys and access

Guests browse/search, select dates/party/quantity, review the full price and terms, verify email, submit, track and cancel requests, contact the responsible property, save/share places and report issues. Confirmed details should explain arrival and pay-at-property amounts. Arrival, no-show and post-check-in cancellation require decisions before implementation.

Owners onboard and prepare listings, submit for publication review, maintain owned supply, respond to bookings, record external reservations and eventually perform approved arrival/payment/completion actions. Booking status and payment status are separate; recording payment is not processing or independently verifying money.

Super admin manages platform accounts, moderation, categories/destinations, review, reports, support and settings. It does not routinely accept bookings, maintain owner calendars or impersonate owners. Support access needs a distinct audited procedure.

Guests read only their own bookings; owners read only their own properties and associated requests. Guest contact is private and disclosed to the responsible owner for request handling. Pausing stops new requests while preserving existing records/actions. Suspension must not silently cancel stays.

## Accepted booking disclosure — 30 October 2026

The owner accepted [D17 and the two-slice journey](booking-journey-proposal.md#approval-record-and-next-action): private logistics is visible to the booking guest only while Confirmed, from an immutable copy previewed and saved when the owner accepts. New acceptance requires an address and contact method. Pending/terminal states hide logistics; earlier bookings without a copy show unavailable details, without historical backfill. Existing price/policy/terms commitments remain submission-time snapshots. Current verified owners retain their property/booking access. This does not create public location/contact access, a corrections or retention policy, arrival actions, support powers, legal text or deployment approval.

## Notifications and trust

The booking record is authoritative; verification and important booking events use email alongside in-app records. Intended events include submission, owner reminder, acceptance/decline/expiry, cancellation and useful arrival reminders. Reminder timing and live delivery are not settled. Failure to notify must not undo a committed booking or lose its durable event. Changes must have attributable history.

First-property review is a basic trust control, not a guarantee of service quality. Repeated non-response, cancellations and no-shows should be visible for review; do not invent automatic punishments. Privacy, platform terms, support contacts, retention and moderation responsibilities require review before public launch.

## Deferred scope and pilot acceptance

Defer online payments/deposits/refunds/automatic fees, instant booking, channel sync, staff invitations, reviews/ratings, promotions/loyalty/complex rate plans/advanced reporting, restaurant/activity reservations, native apps and paid owner pricing.

Pilot acceptance must prove inventory races/rollback/retries, immutable quotes, deadline/cancellation boundaries, private access, recoverable notifications and usable Khmer/mobile flows. Candidate measures include setup completion, usable published listings, response/expiry/acceptance/completion rates, cancellations, conflicts, support and delivery outcomes. These are suggested measures, not approved numeric targets.

The [screen brief](../design/screen-brief.md) describes intended screens. It cannot override this policy or turn planned behavior into an implemented claim.
