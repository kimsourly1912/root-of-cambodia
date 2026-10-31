# Screen and prototype brief

**Status:** current design guidance; future screen scope explicitly planned.

**Responsible role:** product/design owner (responsibility, not an assigned person).

**Last source verification:** 30 October 2026; owner-response implementation based on guest PR #25 head [a5bf41f](https://github.com/kimsourly1912/root-of-cambodia/commit/a5bf41ff6d54351358cd307b5ef4b9ded3f9d233).

**Sources:** [apps/web/components/](../../apps/web/components), [apps/web/app/owner/](../../apps/web/app/%28workspace%29/owner), [apps/web/app/layout.tsx](../../apps/web/app/layout.tsx), [docs/archive/2026-10/Claude-Mockup-Brief.md](../archive/2026-10/Claude-Mockup-Brief.md).

Use [product scope](../product/scope.md) for policy, [feature contracts](../README.md#feature-contracts) for real behavior and [status](../status.md) for delivery. The archived brief's claim that the main app does not exist and its instruction to create a parallel mockups/web app are superseded. The active app is apps/web. Do not scaffold a second app or change backend/pins/deployment merely to make a prototype.

## Existing UI and visual direction

How to build screens (components, tokens, states and wording) is defined by the [UI standard](ui-standard.md) and its [component catalog](components.md); this brief covers visual direction and what each screen may promise. Owner routes include draft basics, rooms, weekly prices/stock, information, private photos and Location & contact (optional coordinates, informational contact methods and arrival notes). Current working copy is mostly English; full Khmer-first delivery is a goal.

Design defaults, not new product rules: light warm-neutral surfaces, white cards, charcoal text and restrained deep green; hospitality photography, useful spacing and clear price/date hierarchy. Avoid decorative temple/flag overload. Guest flows are mobile-first; owner/admin should be efficient on desktop and usable on phones.

Use semantic visible labels, keyboard/focus/error handling, adequate contrast/touch targets, status text as well as color, mixed Khmer/Latin wrapping and readable dates/currency. Translation uncertainty belongs in review notes outside customer flows. Do not claim accessibility compliance from source/emulation alone.

## Guest screen direction and current coverage

| Screen | Intended content / states |
| --- | --- |
| Discover/search | Province/destination, dates, guests/quantity, photo/name/facilities/stay-total cards, bounded filters; loading/no-results/invalid/unavailable/location-denied; map only a placeholder until provider approval |
| Property/room selection | Gallery/details/facilities/location/policies, room capacity/quantity/price, visible dates/party and summary; sold-out/inactive/date-needed/unavailable states |
| Review request | Full nightly/charge/total breakdown, identity and terms; signup/signin/verification/recovery gates; explicit changed-price review, submitting/unavailable/session-expired/uncertain retry |
| Booking detail/result | Pending reference/deadline/no hold; Confirmed arrival/contact/pay-at-property; Declined/Expired/new-search; Cancelled attribution/reason; supported cancellation confirmation |
| My bookings | Upcoming/past grouping, status/date/property/total/reference and view action; signed-out/empty/loading/failure |

Read-only /stays and /stays/:id are now implemented under the [guest-browsing contract](../features/guest-browsing.md), with an explicit public field/photo boundary. The date/party/quote/request/My bookings journey now exists under the [booking contract](../features/bookings.md), including verified auth return and recoverable saved reviews. Broader discovery date/availability filters remain planned; implemented private collection routes are documented separately.

Copy must say “Request to book” / “Pending confirmation” until owner acceptance succeeds. Show complete price, $0 due now, pay at property and exact Cambodia-time deadline. Pending does not reserve a room; an acceptance stock conflict is not confirmation. Cancellation is free before scheduled check-in; 24 hours is encouragement, not a fee cutoff. After cutoff, use the approved contact/support path once defined; do not invent arrival/no-show/late-cancellation timing.

Do not add card checkout, deposit/Pay now, phone OTP, instant booking, ratings/reviews, coupons/loyalty, AI chat/social feed or unsupported quality badges.

## Owner and future admin design

Property-scoped booking list/details/response now exist, including saved acceptance previews and private confirmed logistics. Owner overview/property switcher, external entry and arrivals/payment remain future work beyond the implemented private supply/publication/booking screens. Pending should not reduce booked stock; acceptance requires an actual server success. Stale calendar/gallery edits require refresh/review, never silent overwrite. Owner cancellation needs a reason. Pause must retain upcoming booking visibility. Payment record and booking state stay distinct.

Broad admin support/account/report screens are planned; the configured single-reviewer publication workflow already exists. Review decisions need attributable reasons; no routine owner impersonation or silent cancellation on suspension. Publication, external contact/pricing/consent, support and arrival choices in [open decisions](../product/open-decisions.md) block final behavior.

## Prototype boundaries and consistent fixture

Future authorized prototypes may use isolated fictional data/mock state within the existing project approach, with preview controls outside customer flows. Simulated identity/acceptance is not security, allocation or payment enforcement. Do not connect live auth/email/D1/maps/storage or deploy unless that task authorizes it.

The original fictional fixture remains useful: Kampot Riverside Stay (fictional), Garden Bungalow, two adults/one room, 13–15 November 2026, check-in 14:00/check-out 12:00 Cambodia time, two nights at $35, $0 mandatory charges, total/pay-at-property $70, due now $0; Sokha, sokha@example.invalid, ROC-1042. Freeze demo time at 1 November 2026 10:00 and response deadline at 22:00; do not calculate historical sample expiry from the viewer's date. Keep one coherent fixture throughout, separate from other example listings.

Use placeholders or appropriately sourced imagery; no copied business photos or invented real reviews. Keep credentials/real guest details out of screenshots. Label assumptions in design notes and preserve unresolved decisions.

## Acceptance for future UI work

Deliver a coherent authorized screen flow with exact commands/route map, implemented/mock/planned distinctions and component reuse/assumptions. Inspect approximately 1440px desktop and 390px phone plus long/mixed-script text. Make empty/loading/disabled/error/conflict/expiry/uncertain states reviewable. Preserve same-operation retries and explicit new-attempt semantics from feature contracts; client mock state cannot enforce them.

The old prototype phase order is historical guidance, not a new implementation priority over already built owner supply. No screen work is authorized by documentation consolidation.
