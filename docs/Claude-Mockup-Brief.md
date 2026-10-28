# Root of Cambodia — Claude Screen Mockup Brief

Date: 28 October 2026

Purpose: A self-contained brief for designing and prototyping screens. Use the product plan for scope, this brief for screen behavior, and the technical plan for implementation constraints.

## Copy this prompt into Claude Code

```text
Work on Root of Cambodia's interface mockups.

Read:
1. docs/Claude-Mockup-Brief.md
2. docs/Root-of-Cambodia-Product-Plan.md
3. docs/Root-of-Cambodia-Build-Specification.md
Use docs/Root-of-Cambodia-Technical-Plan.md only for technical constraints.

Implement Phase 1 from the mockup brief as a polished, responsive, clickable
Next.js + React + TypeScript + shadcn/ui + Tailwind prototype under mockups/web/.
Use fictional local fixture data and a clearly isolated mock state layer.
The main application does not exist yet. Keep proofs/foundation/ as a separate
compatibility fixture; do not turn it into the product or change its backend.

Complete the five guest screens and their important states in one coherent flow.
Start with the visual direction below; do not add new product features.
Use one consistent property, room, dates, guest count, total, and booking reference
throughout the flow. Include a light preview control outside the customer flow
to inspect pending/confirmed/declined/expired/cancelled and failure states.

Do not connect live authentication, email, D1, payments, maps, or storage.
Do not edit SQL, migrations, booking services, package versions in the foundation
proof, deployment settings, or the agreed product scope. Do not deploy or publish.
Do not silently resolve the policies marked open; document those assumptions.

Use actual shadcn/ui components where appropriate, reusable layout/field patterns,
semantic markup, clear validation, accessible keyboard/focus behavior, and
responsive layouts. Use current installed APIs and official docs where needed.
Keep third-party dependencies small and select a single consistent component base.

Show the result in a runnable local preview. Check desktop and phone widths.
Report implemented screens/states, exact run commands, and remaining assumptions.
Include screenshots if your environment supports them. Do not claim mock actions
are real bookings or security enforcement.
```

This prompt targets Claude Code with repository access. Attach this file for a standalone Claude chat; its sections below include the product essentials without requiring the whole repository.

## If using Claude chat / Artifacts instead

```text
Use the attached Root of Cambodia mockup brief to create a clickable React
Artifact for Phase 1. Use the same visual direction, fictional fixture, booking
rules, responsive behavior, and state coverage. An Artifact is a visual prototype;
keep it self-contained with local mock state. Use shadcn-style components only
where supported by the Artifact runtime. Do not claim this is the Next.js backend
or a deployable production application. Finish Phase 1 before adding owner or
admin screens.
```

## 1. Product essentials

Root of Cambodia helps people living in Cambodia discover places across the country and request accommodation bookings directly from property owners.

- Audience: Cambodian users; coverage starts with selected listings across Cambodia.
- Accommodation first: hotels, resorts, guesthouses, bungalows, homestays.
- Other places can be discovered later; restaurant/activity reservations are deferred.
- Guest, owner, and super admin are different experiences.
- Owners manage their properties, rooms, availability, prices, and booking responses.
- Super admin provides the platform, publication review, moderation, and support.
- One person may be a guest and an owner; one owner may have several properties.
- Initial language direction: Khmer first; support Khmer and English place-name search.
- Currency: USD for booking prices. Riel conversion is not yet specified.
- Auth: email/password with email verification. No phone verification.
- Payment: directly at the property, with no deposit or online payment in version one.

## 2. Booking behavior that the UI must preserve

1. Users choose check-in/check-out dates, adults/children, room type, and quantity.
2. A stay request must be at least 24 hours before the property's check-in time.
3. Show the full price, including mandatory charges, before submission.
4. The main action is Request to book.
5. Submission creates Pending confirmation, not a confirmed reservation.
6. Owner has 12 hours to accept/decline; show the exact response deadline.
7. Pending requests do not reserve a room. Explain that confirmation is required.
8. Acceptance is only successful if every occupied night has sufficient capacity.
9. A request cannot be accepted after its deadline.
10. A submitted price/room/date/policy snapshot cannot be silently edited.
11. Guest changes use cancellation + a new request in version one.
12. Guest cancellation is free before check-in. Encourage 24 hours' notice without implying a fee cutoff.
13. Owner cancellation requires a reason and guest notification.
14. Booking status and payment status are separate.
15. Rooms have a quantity per type; unique units can have quantity one.
16. Paused listings stop new requests while existing bookings remain visible.

The UI must not show Pay now, a card checkout, a deposit, a phone OTP, or instant confirmation. Do not add ratings/reviews, coupons, loyalty, AI chat, social feeds, delivery ordering, or channel-manager sync.

## 3. Proposed visual direction

These are design defaults, not new product requirements:

- Light mode first, warm-neutral page surfaces, white content cards, charcoal text, and a restrained deep-green primary accent.
- Hospitality photography, generous but purposeful spacing, clear hierarchy, and readable price/date summaries.
- A clean contemporary Cambodian travel brand; avoid filling the UI with decorative temple or flag imagery.
- Guest experience: mobile-first with a strong desktop composition.
- Owner/admin: desktop-efficient with usable phone layouts.
- Use consistent spacing, radius, typography, form fields, status badges, and action placement.
- Build around shadcn/ui primitives: Button, Card, Badge, Input/Field, Select or Combobox, Calendar/Popover, Sheet/Dialog, Alert, Tabs, Table, Skeleton, and confirmation dialogs.
- Select a legible Khmer font with Latin fallback and test mixed-script labels, dates, and wrapping. Do not fabricate long Khmer copy if uncertain; mark translations for review outside customer screens.
- Use visible labels, useful error text, focus states, adequate contrast, and appropriately sized phone controls.
- Label statuses with text as well as color.

Photography can use safe placeholders. Keep fixture property names visibly fictional in the prototype documentation. No copied business photos or invented real reviews.

## 4. Consistent fictional fixture

| Field | Value |
| --- | --- |
| Property | Kampot Riverside Stay — fictional |
| Province | Kampot |
| Room type | Garden Bungalow |
| Guests | 2 adults |
| Quantity | 1 room |
| Check-in | 13 November 2026, 2:00 PM, Cambodia time |
| Check-out | 15 November 2026, 12:00 PM, Cambodia time |
| Length | 2 nights |
| Rate | $35 per night |
| Mandatory charges | $0 in this illustrative fixture |
| Stay total | $70 |
| Due when requesting | $0 |
| Payable at property | $70 |
| Guest | Sokha; sokha@example.invalid |
| Booking reference | ROC-1042 |
| Demo current time | 1 November 2026, 10:00 AM, Cambodia time |
| Response deadline | 1 November 2026, 10:00 PM |

Freeze the demo clock for deadline states. Do not calculate sample expiry against the viewer's real date.

Nearby fictional listings may be added to populate search results. Keep their data separate from the main booking fixture.

## 5. Phase 1 — guest journey

Complete these five composed screens before moving to Phase 2.

### G1. Search / discover accommodation

- Header with brand, navigation, saved places, and account entry.
- Destination/province search; check-in/check-out; guest/room counts.
- Search result cards with photo, name, location, key facilities, and total for the selected stay.
- Clarify nightly price versus full-stay total.
- Useful bounded filters: property type, budget, facilities.
- Desktop can offer a list/map switch or split-map placeholder; phone uses a deliberate map action.
- A map is a visual placeholder only; do not require a live API key.
- Loading skeleton, no results, invalid dates, unavailable dates, and denied-location fallback.
- Primary action opens the property details.

### G2. Property details and room selection

- Photo gallery, title, location, facilities, description, and directions placeholder.
- Check-in/out and cancellation information.
- Room cards: beds, capacity, facilities, photos, price, quantity, and request eligibility.
- Keep selected stay dates/guests visible and editable before submission.
- Desktop booking summary may be sticky; phone uses a compact sticky action/summary.
- Action: Review request or Request to book, consistently leading to G3.
- States: sold out, inactive room, dates needing selection, property unavailable.
- No unsupported quality-certification or review badges.

### G3. Review booking request

- Property/room, dates, guests, quantity, nightly breakdown, all charges, total, and policy.
- Guest name and email identity; optional notes.
- Sign-in/verification gate states: signed out; signed in and verified; verification pending; resend limited; expired verification link.
- Price changed before submission: present the revised amount and require explicit review.
- Primary action: Send booking request.
- Prominent copy: owner confirmation required; $0 due now; pay $70 at the property.
- States: submitting, temporary failure with retry, session expired, and room no longer available.
- Do not request card details, payment method selection, or a verified phone.

### G4. Booking details / result

- Pending: clear heading, reference, response deadline, complete stay summary, and cancel action.
- Confirmed: arrival information, owner contact, pay-at-property amount, and applicable cancellation.
- Declined: clear outcome and return-to-search action.
- Expired: clear outcome, no confirmed reservation, and start a new request action.
- Cancelled: who cancelled, time, and owner reason when relevant.
- Keep payment status distinct from booking status.
- Inventory failure on acceptance is not a successful confirmation.
- Cancellation confirmation dialog states free cancellation before check-in.
- After check-in, show the supported contact path; do not invent a late-cancellation policy.

### G5. My bookings

- Clear upcoming and past grouping with status/date information.
- Each entry shows property, room/stay dates, total, reference, and one clear view-details action.
- Pending entries show response deadline.
- Signed-out, empty, loading, and failed-load states.
- Preserve state changes when navigating through the local prototype.

Auth screens can be route views or composed gate states as needed. Include registration, sign-in, verify-email, and forgot/reset-password screens to make the guest flow understandable, but do not wire a live provider.

## 6. Phase 2 — owner experience

Only build this phase after Phase 1 can be reviewed as a complete flow.

| Screen | Key contents |
| --- | --- |
| O1 Overview | Property switcher, requests needing response, upcoming arrivals, calendar shortcut |
| O2 Property setup/editor | Information, location, photos, facilities, room setup, rates, policies, saved draft, first-property review state |
| O3 Availability and rates | Dated room-type grid; total/booked/blocked quantities; price editing; maintenance blocks |
| O4 Booking list/details | Reference, guest, room/dates, total, notes, deadline; accept/decline; cancellation with reason; arrivals/payment as separate actions |
| O5 External booking entry | Dates, room type/quantity, guest/contact information, and availability validation using the same stock model |

Important states:

- Pending requests do not reduce displayed booked stock.
- Accept is loading while processing, then confirmed only on success.
- A conflict explains that the room is no longer available for all selected nights.
- Stale calendar edits show a refresh/review path rather than overwriting another update.
- Capacity/blocks cannot make stock smaller than already committed reservations.
- Owner cancellation requires a reason.
- Owner has only their own properties.
- Pausing a property does not hide upcoming bookings.
- No-show/late-arrival timing remains open; label assumptions in design notes instead of presenting an invented policy as final.
- Staff invitations, complex extra-bed pricing, promotions, advanced reports, and external platform synchronization are deferred.

## 7. Phase 3 — super admin

- A focused publication-review queue and property review screen.
- Owner/account overview and reported-listing/support queue.
- Show attributable review decisions and reasons.
- Super admin does not routinely accept guest reservations or maintain room stock.
- Do not add owner impersonation as an unrequested shortcut.
- Account suspension handling for existing stays is an open operational policy, not a reason to silently cancel them.

## 8. Prototype implementation boundary

For Claude Code, put mockup work under mockups/web/ with its own minimal runnable setup. Keep its fixture data, domain view models, and mock transitions distinct from reusable presentational components.

Do not rewrite the existing proof or implement database/auth/email code while drawing screens. Do not upgrade proof dependency pins to make the mockup run. Avoid introducing global state libraries unless the prototype needs them.

Show mock states using a small preview panel outside normal guest/owner interactions. A simulated sign-in or acceptance must be documented as local demo behavior. Never imply that client state enforces real authorization, inventory, or payment rules.

No screenshots/design annotations should expose credentials or real guest details. Keep unresolved assumptions in a separate design note.

## 9. Deliverables and acceptance checklist

- Runnable mockup and exact local commands.
- Phase 1 route/screen map with links.
- Desktop review at approximately 1440 px and phone review at approximately 390 px.
- Consistent fixture across every booking step.
- Pending versus Confirmed wording and inventory behavior are distinct.
- Pay-at-property total and $0 due now are visible.
- Verification is email-based; no phone OTP.
- Disabled, loading, empty, error, conflict, and expiry states are inspectable.
- Forms have labels, visible validation, keyboard access, and sensible phone behavior.
- Long names, mixed Khmer/English text, and narrow headers do not overflow.
- No deferred features or invented business policies.
- Brief summary of component reuse, assumptions, and unimplemented integrations.

## 10. Which document should Claude use?

| Document | Use |
| --- | --- |
| This mockup brief | Primary screen-design and prototype instructions |
| Product plan | Authoritative agreed scope and business behavior |
| Build specification | Data/state/access contracts that UI must respect |
| Technical plan | Framework, hosting, infrastructure, and integration constraints |
| Foundation proof/check | Compatibility evidence, not a product UI template |

If a document conflicts with a newer explicit user decision, follow the user decision and note the conflict. The proof's limited state model does not reduce the product's agreed screen scope.
