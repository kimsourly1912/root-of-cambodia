# Owner inventory operations and external reservations

**Status:** two focused local implementation steps within existing accepted rules; not a live-release approval.
**Responsible role:** owner-operations maintainer.
**Last source verification:** 30 October 2026, main badd76c9c2d541f12676235e46cc1f0579881090.

## Authority and architecture

After the repaired PRs #27/#28 merged, the project owner requested starting the next two steps. The maintainer selected missing owner interfaces for existing inventory edits and catalog-priced external allocations. These implement the already accepted owner/inventory scope in [product rules](scope.md) and [booking contract](../features/bookings.md), rather than resolving new D04 external guest/contact/negotiated-price policy.

Reuse the existing Next.js/shadcn UI, verified-owner checks, bounded scoped reads, shared services, named atomic persistence and D1 safeguards. No new backend service, framework, dependencies, providers, cost or deployment is introduced. Draft calendar/content editing remains draft-only; the separate operational screen exposes existing versioned inventory edits for already configured nights across listing states. Reserved stock remains controlled by booking transitions.

## Step A: configured-night availability

Owners choose an owned room type, browse a seven-night Cambodia-date window and change capacity/blocked counts for one configured night. Reserved and price are read-only. Missing nights are displayed honestly; this screen does not create missing rates/stock or edit published prices/content. Current ownership, verification, revision and capacity >= blocked + reserved are checked by the existing service/database.

Save freezes the exact key/body while uncertain; errors never imply a failed commit. Retry reuses them. Definitive stale conflicts require latest-state reload. The pending attempt lasts only in the open tab; reload/week change discards it. Sign-in recovery opens a separate tab so the original pending form remains available. Successful saves instruct reloading before another edit; counts are labelled as the loaded snapshot. No multi-night all-or-nothing claim is made.

The existing draft setup remains an alternative for new rows/rates. Reusing it for published content edits would cross D05; that broader policy is not selected here.

## Step B: external stock reservation

Provide a separate owner selection/review/explicit-confirmation path around the existing external source, with immediate all-night allocation at catalog prices and no fabricated guest identity/contact. Exact dated prices, occupancy selections, charges and policies remain server-authoritative. An immutable owner/property-bound saved review and opaque recovery identifier prevent ambiguous confirmation from creating another booking. Additive 0017 follows the existing server-saved-attempt architecture, fences the stable key to its exact fingerprint and preserves older records. Current terms are selected on the server and shown as a saved version, without implying guest legal consent. The screen uses bounded twenty-room pages and up to ten selections from the current page; changing room pages discards unsaved selection.

No negotiated prices, guest personal details, deposits, new cancellation/no-show rules, physical room assignment or assumed guest legal consent are introduced. D02/D03/D04 and actual legal/release gates remain open. This is a stock-booking record, not a complete external booking-management product.

## Verification and delivery

Use meaningful owner/isolation/revision/retry/stock scenarios through the actual built Worker and matching Chromium desktop/phone checks. For review storage, add native D1 race/replay/rollback/upgrade cases. Preserve earlier tests. GitHub CI supplies fresh application execution because the older Windows checkout has unrelated untracked work and direct GitHub network access is unavailable; no local execution is claimed without actually running it.

Both steps remain separate review PRs. This continuation authorizes implementation and checks; it does not automatically merge new PRs, deploy, provision resources, spend or apply remote migrations.
