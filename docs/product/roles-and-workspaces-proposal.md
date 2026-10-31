# Account roles and workspaces proposal

**Status:** accepted on 31 October 2026 ([approval record](#approval-record)); implementation follows slices 1–4. This decision document is not execution evidence.

**Responsible role:** project owner (policy); technical maintainer (implementation).

**Last source verification:** 31 October 2026, main [4d2bffb](https://github.com/kimsourly1912/root-of-cambodia/commit/4d2bffb).

**Sources:** [accepted scope](scope.md), [open decisions](open-decisions.md) (D06, D11, D15), [actor type](../../packages/backend/src/shared/operations.ts), [owner session](../../apps/web/server/owner-session.ts), [property creation route](../../apps/web/app/api/owner/properties/route.ts), [reviewer check](../../packages/backend/src/features/publication/publication-queries.ts), [reviewer command](../../scripts/configure-reviewer-local.ts), [site header](../../apps/web/components/site-header.tsx), [owner layout](../../apps/web/app/%28workspace%29/owner/layout.tsx), [review layout](../../apps/web/app/%28workspace%29/review/layout.tsx), [staging accounts](../../apps/web/server/staging-accounts.ts).

## Problem

The product has three kinds of people: **guests** who browse and request stays, **owners** who join the platform to publish their properties, and **platform admins** (the project team) who oversee everyone. [Scope](scope.md#intended-journeys-and-access) already describes all three, including a super admin who "manages platform accounts, moderation, … review, reports, support and settings".

The code does not separate them yet. Before routes, layouts and screens are split by role, the roles themselves need a clear definition: how someone becomes each one, what each may see and do, and how the server checks it.

## Current behavior

| Area | Today |
| --- | --- |
| Account model | One account type. The server actor is only `{ id }` ([operations.ts](../../packages/backend/src/shared/operations.ts)); there is no role or capability on it |
| Guest | Any verified account. Guest reads are limited to the guest's own bookings |
| Owner | Implicit. Any verified account can create a property draft ([route](../../apps/web/app/api/owner/properties/route.ts)); "owner" means "owns at least one property". There is no owner sign-up step, owner terms or owner profile |
| Reviewer | A single account stored in `pilot_publication_config`, set by a trusted local command ([configure-reviewer-local.ts](../../scripts/configure-reviewer-local.ts)) and checked by `canReview()` |
| Platform admin | Does not exist. D06 (admin powers, stronger sign-in, audit, suspension) is open |
| Navigation | One public header for everyone. "Owner workspace" shows to every visitor when the site is not read-only, signed in or not ([site-header.tsx](../../apps/web/components/site-header.tsx)). `/owner` and `/review` each add one row of links; `/review` links back to `/owner` |
| Staging | Three fictional accounts: owner, guest, reviewer ([staging-accounts.ts](../../apps/web/server/staging-accounts.ts)) |

Two gaps follow from this. First, "owner" is not a deliberate choice: a guest who opens the owner workspace is already an owner, even though [scope](scope.md) describes the pilot as "free pilot for selected owners". Second, the person who oversees the platform has only one power, publication review, and that power sits under its own `/review` area rather than an admin area.

## Where your model and accepted scope differ

Scope says **"A person can be both guest and owner"**. That means one account, not separate guest and owner accounts. This proposal keeps that rule: an owner can still book stays elsewhere as a guest with the same sign-in. Choosing separate owner accounts instead would be a scope change (see the alternatives).

## Recommendation

### One account, three capabilities

| Capability | How it is gained | Can do |
| --- | --- | --- |
| **Guest** | Every verified account, automatically | Browse, request, track and cancel own bookings |
| **Owner** | An explicit "List your property" owner application, approved by a platform admin during the pilot | Everything owners do today: drafts, rooms, prices, photos, review submission, bookings, availability, payments |
| **Platform admin** | Granted only by a trusted operator command, never through the app, never to the first account and never by an admin to themselves | Publication review (taking over from the pilot reviewer setting), owner applications, a read-only platform directory; further powers only by later decisions |

The server works out capabilities for each request, from the database, inside each service and again inside each write. The layout guard only decides what to show. Hidden navigation is never treated as authorization.

### Owner onboarding (pilot)

1. A signed-in guest selects **List your property** and submits a short owner application: owner or business name, phone, province, and acceptance of the owner terms version (the text itself stays D15).
2. A platform admin approves or declines it with a reason. Both outcomes are recorded with who, when and why.
3. Approval enables the owner workspace. Creating drafts requires an approved owner, checked at the property-creation service and inside its write.
4. **Existing accounts that already own a property are recorded as approved owners by the migration**, so nobody loses access to current drafts, listings or bookings.

This matches "selected owners" and keeps uploads and drafts limited to known owners while abuse budgets (D11) are open. Publication review stays as it is: an approved owner still needs every listing reviewed.

### Platform admin, first slice

- **Grant:** a new `platform_staff` record (account, role `admin`, granted by, granted at, revoked at), written only by a trusted local or operator command. It follows the [reviewer command](../../scripts/configure-reviewer-local.ts) pattern.
- **Review:** the publication review queue moves under the admin area. Review permission becomes "is an active admin", and the existing configuration revision keeps fencing in-flight decisions when admins or terms change. The single-reviewer setting is migrated, not dropped.
- **Owners:** list owner applications; approve or decline with a reason.
- **Directory (read-only):** owners and properties with publication state and counts only. **No guest names, contact details or booking details** in this slice.
- **Audit:** every admin write records the actor, action, reason and time in the same atomic batch as the change.
- **Stronger sign-in:** admin writes require a sign-in from the last 15 minutes. Two-step sign-in (TOTP) is required before any admin account holds real (non-fictional) data, and is decided with D07/D08.

Not in this slice (still D06): suspending owners or listings, support access to bookings or guest data, account editing, reports and moderation, categories, destinations and settings. When those come, the scope rules still apply: no routine impersonation and no silent cancellation on suspension.

### Routes and layouts by role

| Area | Who | Layout | Routes |
| --- | --- | --- | --- |
| Public and guest | Everyone; signed-in guests for their bookings | Top site header | `/`, `/stays`, `/stays/[id]`, sign-in pages, `/bookings` |
| Owner workspace | Approved owners | Sidebar workspace shell | `/owner/...` (unchanged URLs); `/owner/apply` for applicants |
| Admin console | Platform admins | The same sidebar shell, with an "Admin" label and its own menu | `/admin` overview, `/admin/reviews` (from `/review`, which redirects), `/admin/owners`, `/admin/properties` |

The header shows **List your property** to guests who are not owners, **Owner workspace** to owners and **Admin** to admins. Signed-out visitors see only browsing links and sign-in. One account with several capabilities switches between areas from the account menu.

## Alternatives

| Option | Effect | Tradeoff |
| --- | --- | --- |
| **Recommended:** one account, admin-approved owner application, admin role by operator command | Deliberate owner onboarding; one sign-in per person; matches accepted scope | One migration with backfill; a small admin approval step for each new owner |
| Self-serve owner: any guest can turn on owner mode, with publication review as the only gate | Fastest onboarding | Unknown accounts can upload photos and create drafts while D11 budgets are open; weaker "selected owners" control |
| Separate owner and guest accounts | Strict separation by sign-in | Changes accepted scope; owners need two accounts to book as guests; duplicated auth, verification and recovery |
| Keep today's model and only change the UI | No backend work | Navigation would suggest roles the server does not enforce; admin stays limited to review |

## What stays unchanged

- Existing accounts, properties, listings, bookings, snapshots, receipts and history. Earlier rows are backfilled, never rewritten.
- Booking, stock, price and payment rules; guest and owner privacy boundaries; owner access to their own records.
- Atomic operations: a role check and the write it protects commit together.
- Staging stays fictional. The fixture reviewer account becomes the fixture admin, and the fixture owner becomes an approved owner.

## Implementation slices (after acceptance)

1. **Workspace shell (UI only, already agreed).** Route groups, the shadcn sidebar shell and the owner menu. No role changes; it can start before this decision.
2. **Role foundation.** Migration 0021 (`platform_staff`, owner application/approval with backfill), a capability read, an operator command, header links by capability, and the reviewer check moved to "active admin".
3. **Owner onboarding.** `/owner/apply`, the gate on property creation, and admin approve/decline.
4. **Admin console.** `/admin` overview, reviews (with the `/review` redirect), owners and the read-only directory, with recent-sign-in required for writes.

### Acceptance tests

- A verified guest without approval cannot create a draft through the page or the API, and the refusal is repeated inside the write.
- Existing property owners keep full access after the migration, on both a fresh install and a populated upgrade.
- A non-admin cannot read or act in `/admin` or its APIs. A revoked admin is refused at commit time, even mid-request.
- Admin approve, decline and review decisions record actor, reason and history atomically, and a retry with the same key replays the receipt.
- No admin screen in this slice returns guest contact or booking details.
- Navigation shows the right links per capability, and desktop and phone e2e pass.

## Still open after this decision

D06 suspension, support access, audit review and escalation; TOTP provider and timing; D15 owner terms text; D11 budgets; D13 Khmer copy for the new screens; whether a person can hold several admin roles (for example a reviewer-only staff role) later.

## Agreement question

Do you accept the recommendation above: one account with guest, owner and platform admin capabilities; owners join through an admin-approved application, with current owners backfilled as approved; admins are granted only by operator command; the first admin slice covers review, owner applications and a read-only directory with no guest data; and implementation follows slices 1–4 in that order?

## Approval record

On 31 October 2026, after this agreement question, the project owner replied “yes go ahead”. This accepts the recommendation as written: one account with guest, owner and platform admin capabilities; admin-approved owner applications with current property owners backfilled as approved; admin granted only by operator command; a first admin slice of publication review, owner applications and a read-only directory without guest data; and slices 1–4 in that order. [ADR 0010](../architecture/decisions/0010-account-capabilities.md) records the architecture boundary.

D06 is partially resolved. Suspension, support access to bookings or guest data, escalation, TOTP provider and timing, D15 owner terms text, D11 budgets and D13 copy remain open. This approval authorizes local implementation and checks for each slice. It does not authorize merging, deployment, remote migrations, spending or granting a real person admin on staging or production.
