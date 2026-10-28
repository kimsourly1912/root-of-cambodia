# Root of Cambodia — First-Version Product Plan

Implementation update (28 October 2026): the [backend foundation review](Root-of-Cambodia-Backend-Foundation-Review.md) records the new application migrations/services, 24 D1 tests, 12 built-Worker checks, and unresolved release gates. Earlier proof results below are historical; no production verification or deployment is implied.

Updated: 28 October 2026

Status: Product direction and overall application architecture agreed. See the [architecture decision](Root-of-Cambodia-Architecture.md). A backend foundation is locally tested and the detailed booking/database direction is approved. Implementation hardening, unresolved product policies and staging verification remain open.

Purpose: Preserve the agreed scope and product policies. Implemented and approved work is recorded in the architecture decision and backend review; this product document alone does not authorize service purchases, deployment or public launch.

Revision note: The user replaced phone verification with email verification and selected Next.js full stack with shadcn/ui. D1 is now the approved initial database, subject to detailed persistence review and the technical-plan verification gates. These decisions supersede the earlier phone/Nuxt/PostgreSQL proposals.

## 1. Product goal

Help people living in Cambodia discover places across the country, find useful visiting information, and request accommodation bookings directly from participating owners.

Accommodation is the first complete booking experience. Restaurants, cafés, attractions, and activities support discovery; reservations for these categories come later.

The long-term vision is broad coverage across Cambodia. Launch coverage consists of selected listings across different provinces, not a claim to list every place.

## 2. Agreed decisions

| Area | Decision |
| --- | --- |
| Initial audience | Cambodian users |
| Geographic coverage | Across Cambodia, beginning with selected listings |
| Language direction | Khmer first; support Khmer and English place-name search |
| Accommodation | Hotels, resorts, guesthouses, bungalows, and homestays |
| Booking method | Request-to-book; owner acceptance is required |
| Payment | Guest pays directly at the property; no platform payment collection in version one |
| Owner operations | Owners manage their own information, rooms, prices, availability, and bookings |
| Platform operations | Super admin provides account management, moderation, support, and platform settings |
| Accounts | A person can be both guest and owner; owners can manage multiple properties |
| Initial owner access | Owner accounts only; staff invitations are deferred |
| Publication | Owner verifies their email; first property is reviewed before publication |
| Ongoing updates | Owners update information themselves; moderation and reports remain available |
| Response deadline | Accept or decline within 12 hours; otherwise the request expires |
| Booking lead time | Requests must be submitted at least 24 hours before the property's check-in time |
| Cancellation | Free cancellation before check-in; encourage at least 24 hours' notice |
| Guest verification | Signed-in account, guest name, verified email address, and acceptance of booking terms |
| Inventory | Room types with quantities; unique units have separate options with quantity one |
| Primary currency | USD for version-one booking prices |
| Price commitment | Preserve the full quoted price when the request is submitted |
| Changes | No owner changes to submitted dates, rooms, or prices; cancel and submit a new request |
| Pilot revenue | Free pilot for selected owners; paid business model remains undecided |

These are our product decisions. They are not claims that another platform uses the same policies.

## 3. Version-one scope

### Guest website

- Discover selected accommodation and basic listings for other place categories.
- Browse by province, category, and location.
- Search Khmer and English place names.
- Select stay dates, guest counts, room type, and room quantity.
- View property photos, facilities, location, directions, policies, and room details.
- See the complete price before submitting a request.
- Save places and share place links.
- Verify an email address and submit a booking request.
- Track, cancel, and review booking details.
- Contact the responsible property and report a listing or platform issue.

### Owner dashboard

- Create an owner account and prepare a property for publication.
- Manage multiple owned properties.
- Edit descriptions, photos, facilities, location, contact details, and arrival instructions.
- Configure room types, quantities, adult/child capacity, nightly rates, and dated availability.
- Block unavailable inventory for maintenance or other reasons.
- Record reservations received by phone or other external channels.
- Accept or decline booking requests.
- View arrivals, record check-in, record payment received, and complete stays.
- Cancel a booking with a reason when necessary.
- Pause new requests while preserving access to existing bookings.

### Super admin

- Review first-property submissions.
- Manage accounts, categories, destinations, reported listings, and support cases.
- Identify repeated owner non-response or cancellations for review.
- Manage platform configuration and operational visibility.
- Do not routinely accept guest requests or maintain owners' calendars.

## 4. Main screens

| Guest | Owner | Super admin |
| --- | --- | --- |
| Home and discover | Overview | Overview |
| Search results and map | Property list | Owner accounts |
| Property details | Property setup and editor | Property review queue |
| Room selection and booking review | Rooms and rates | Categories and destinations |
| Sign-in and email verification | Availability calendar | Reports and support |
| Request result | Booking list and details | Platform settings |
| My bookings and booking details | Arrivals and stay actions | |
| Saved places and account | Account and publication status | |

Detailed layouts, navigation, empty states, and mobile behavior are design work still to be completed.

## 5. Guest journey

1. Choose a Cambodian destination, check-in/check-out dates, and number of adults and children.
2. Browse suitable stays. Results describe availability as subject to owner confirmation.
3. Open a property and compare room options, facilities, restrictions, and total price.
4. Select a room type and quantity. Validate capacity for the party.
5. Sign in and verify the email address if needed.
6. Review all dates, guests, mandatory charges, property rules, and cancellation terms.
7. Submit a request and receive a reference, response deadline, and Pending confirmation status.
8. Receive acceptance, decline, or expiry notification.
9. If accepted, view arrival instructions, contact details, and the amount payable at the property.
10. Stay at the property and pay there; the owner records operational updates.

A request submission is never presented as a confirmed reservation.

## 6. Owner onboarding and operations

1. Register and verify the owner email address.
2. Add property information, photos, contact details, map location, and check-in/check-out times.
3. Add room types, occupancy limits, quantities, prices, and availability.
4. Submit the first property for review.
5. Address any requested corrections; publication follows approval.
6. Manage information and incoming requests directly after publication.

First-property review is a basic trust control, not a guarantee of service quality or a transfer of business operations to super admin.

Publication rules for additional properties, reviewer checklists, and handling of high-impact edits still require an operational procedure.

## 7. Booking rules and states

### Request deadlines

- Owner response deadline is 12 hours from successful request submission.
- The app shows the exact deadline in Cambodia time.
- Owner receives an immediate notification and a reminder before expiry.
- Acceptance at or after the deadline is rejected even if a background expiry task has not run.
- Expired requests cannot be revived; a guest can submit a new request using current availability and prices.
- Submission requires at least 24 hours before the property's scheduled check-in time.
- Reminder timing is an implementation detail to finalize.

### Proposed state names for design

| State | Meaning | Allowed next outcomes |
| --- | --- | --- |
| Pending | Guest submitted; no inventory reserved yet | Confirmed, Declined, Expired, Cancelled |
| Confirmed | Owner accepted and inventory was reserved | Checked in, Cancelled, No-show |
| Checked in | Guest arrived | Completed |
| Completed | Stay finished | Terminal |
| Declined | Owner rejected the request | Terminal |
| Expired | Owner did not respond before the deadline | Terminal |
| Cancelled | Guest or owner cancelled | Terminal |
| No-show | Guest did not arrive, recorded under an agreed procedure | Terminal |

This state model implements the agreed journey; exact labels and no-show timing remain to be finalized. Cancellation history must record who cancelled, when, and why where required.

Payment status is independent of booking status. Version one can record unpaid or paid at property. It does not process payment or independently verify that money changed hands.

### Cancellation

- A guest may cancel Pending requests freely.
- A guest may cancel Confirmed bookings before the scheduled check-in time without a platform fee.
- Encourage 24 hours' notice; it is not an automatic fee cutoff.
- After check-in time, provide a contact/support path rather than treating the booking as freely cancellable.
- Owner cancellation requires a reason and immediate guest notification.
- Release inventory reserved by a cancelled booking once, without double-counting.
- Preserve the policy accepted by the guest with the booking.
- Repeated cancellations and no-shows are recorded for review; do not invent automatic punishments.

### Changes and price commitment

- Preserve dates, room type, quantity, occupancy, nightly prices, mandatory charges, total, currency, and accepted terms at submission.
- Owner acceptance confirms that snapshot; owners cannot silently change the quoted amount.
- Changed plans require cancellation and a new request in version one.
- Clearly show the applicable cancellation policy before cancelling an existing booking.
- A new request is subject to fresh availability and prices.

## 8. Rooms, quantities, and availability

Example inventory:

| Room option | Quantity | Maximum guests per unit |
| --- | --- | --- |
| Standard Double | 5 | 2 |
| Family Room | 2 | 4 |
| Garden Bungalow | 4 | 2 |
| Unique Riverside Villa | 1 | Set by owner |

- Identical units share a room type and quantity; the owner assigns actual room numbers.
- Distinct accommodation with materially different features or pricing has its own option.
- Version one sells either individual rooms or the whole property for a given property inventory, not both against overlapping stock.
- Validate capacity, room quantity, blocked stock, and availability for every occupied night.
- Check-out date does not consume an additional night.
- Pending requests do not consume inventory or guarantee a room.
- Acceptance rechecks and reserves all nights as one operation.
- Concurrent acceptances must not sell more than the available quantity.
- Declining or expiring a Pending request must not add inventory because none was reserved.
- Owners must record external bookings and maintenance blocks.
- Owners must not reduce capacity below existing reserved inventory without resolving the conflict.
- No automatic synchronization with other booking platforms in version one.

Platform checks prevent conflicts within its own recorded inventory. They cannot see unrecorded reservations made elsewhere. Actual physical-room assignment and continuous availability across a stay need validation with pilot owners during technical design.

## 9. Trust, access, and notifications

### Account and data access

- Anonymous visitors can browse.
- Booking requests require an authenticated account and verified email address.
- Email verification proves access to an inbox, not legal identity or arrival intent. Phone verification is not required; any phone contact field is informational and must not be presented as verified.
- Guests access only their own bookings.
- Owners access only their own properties and associated requests.
- Guest contact details are not public; disclose only to the responsible owner for handling the request.
- Super-admin access is limited to authorized operational needs.
- Owner, booking, and inventory changes require an attributable history.

### Notification events

- Guest submitted a request.
- Owner response reminder.
- Request accepted, declined, or expired.
- Guest or owner cancelled.
- Arrival reminder where useful.

The in-app booking record is authoritative. Use email for verification and important booking notifications, alongside in-app records. Select the email provider after checking delivery, domain setup, quotas, cost, and account requirements. Notification failure must not undo a successful booking or lose the event; technical design must address retries.

### Listing and account operations

- Paused properties stop receiving new requests but retain existing booking records and actions.
- Repeated non-response and owner cancellations should be visible to super admin.
- Reports need a simple reason, reference, and review outcome.
- Suspension handling must preserve access needed to resolve affected upcoming stays; exact procedure remains open.

## 10. Currency, pricing, and revenue

- USD is the initial booking currency.
- Show nightly prices, number of nights, room quantity, all mandatory charges, and the final total before submission.
- Avoid complex extra-bed pricing, promotions, and multiple rate plans in the first release.
- Optional Riel display and conversion rules are not yet specified.
- Guests pay the property directly. Do not show a successful online-payment screen.
- The pilot is free for selected owners.
- Subscription, commission, or other revenue models require a later decision. Do not assume commission collection is reliable when payments occur outside the platform.

## 11. Discovery beyond accommodation

Basic non-accommodation pages can include name, category, description, photos, location, visiting information, hours, prices where applicable, and contact or directions actions.

- Make bookable accommodation and informational places distinguishable.
- Do not show a reservation button for a place without a supported booking workflow.
- Define who creates, claims, and updates non-accommodation listings before that feature launches.
- Defer restaurant and activity reservations.
- Consider opening these basic categories after the accommodation pilot if content management would delay launch.

## 12. Build roadmap

| Phase | Deliverable | Ready when |
| --- | --- | --- |
| 1. Product and technical foundation | This plan, wireframes, stack choice, service cost check, data and access design | Main flows and unresolved launch rules have concrete answers |
| 2. Supply setup | Owner accounts, property review, rooms, photos, prices, and availability | Pilot owners can publish valid, useful accommodation listings |
| 3. Guest discovery | Search, property details, dates, capacity, saved places | Guests can find and understand suitable stays |
| 4. Booking lifecycle | Verification, requests, acceptance, expiry, cancellation, notifications | Complete request-to-stay flow works and inventory remains correct |
| 5. Operations and pilot | Arrival actions, external bookings, reports, support, monitoring | Selected owners can operate without super admin managing daily bookings |
| 6. Expansion | Additional listings and discovery categories | Pilot evidence supports expanding content and operations |

This is an implementation sequence, not a time or cost estimate.

## 13. Verification priorities

Before a pilot, demonstrate that:

- Two simultaneous acceptances cannot reserve the last room twice.
- Multi-night and multi-room bookings reserve the correct quantity on every night.
- Expired or cancelled requests cannot later be accepted.
- Repeated clicks or retries do not create duplicate bookings or release inventory twice.
- A changed listing price does not change a submitted booking quote.
- Pending, declined, and expired requests do not change inventory.
- Owners and guests cannot access another person's private records.
- Property pause and account restrictions do not silently lose upcoming bookings.
- Notification delivery failures remain visible and recoverable.
- Khmer text, email verification, date handling, and key phone-sized screens work with pilot users.

Use targeted checks for these behaviors; detailed test tooling follows the selected stack.

## 14. Remaining work before implementation

| Topic | What remains open |
| --- | --- |
| Technical stack | Next.js full stack and shadcn/ui are selected; validate the proposed Cloudflare Workers deployment, D1 design, authentication integration, media, and jobs |
| Maps and location | Map provider, search/geocoding approach, usage terms, projected cost, treatment of unavailable location permissions |
| Email verification | Transactional email provider, verified sending domain, email-change/recovery flow, resend limits, and abuse controls |
| Notifications | Delivery channels, provider, retries, reminders, operating cost |
| Screen design | Mobile and desktop flows, Khmer typography, accessibility, empty/error states |
| Room operations | Pilot validation of quantity-based rooms versus individual physical-unit needs |
| Guest counts | Exact adult/child capacity rules and treatment of infants, without extra-bed pricing |
| Operational procedures | Property review checklist, no-show timing, account suspension, escalation, permitted owner edits |
| Non-accommodation content | Who supplies, claims, checks, and maintains discovery listings |
| Policies | Privacy, platform terms, support contacts, data retention, moderation and property responsibilities; review before public launch |
| Pilot logistics | Initial owners/properties, launch checklist, operating budget, and success measures |

Do not represent these open items as already decided or researched.

## 15. Deferred features

- Online payment, deposits, refunds, and automatic cancellation charges.
- Instant booking.
- Channel-manager synchronization.
- Owner staff invitations.
- Reviews and ratings.
- Promotions, loyalty points, complex rate plans, and advanced reports.
- Restaurant and activity reservations.
- Native mobile applications.
- A paid owner pricing model.

## 16. Suggested pilot measures

These are proposed measures, not agreed targets:

- Owners completing property setup.
- Published properties with usable photos, prices, and availability.
- Median owner response time and request expiry rate.
- Request acceptance and confirmed-stay completion rates.
- Guest and owner cancellation rates.
- Inventory conflicts and support cases.
- Notification delivery outcomes.
- Guest and owner feedback on booking clarity.

Set target values after recruiting pilot owners.

## 17. Research references

References used earlier to compare product patterns; our rules above take precedence for this project.

- Tripadvisor — broad place discovery: https://www.tripadvisor.com/
- Klook Cambodia — destinations and bookable experiences: https://www.klook.com/en-US/destination/co1008-cambodia/
- Khmersabai — Cambodia discovery, tickets, and experiences: https://khmersabai.com/how-to-use
- Airbnb — request response deadline reference: https://www.airbnb.com/help/article/75
- Better Auth — email verification integration reference: https://better-auth.com/docs/concepts/email
- Booking.com — inventory quantities by room type reference: https://developers.booking.com/connectivity/docs/b_xml-availability

These sources informed earlier discussion. Service pricing, integrations, legal obligations, and technical compatibility still require current verification when selected.
