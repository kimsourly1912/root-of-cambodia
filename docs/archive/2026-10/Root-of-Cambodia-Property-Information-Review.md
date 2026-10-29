> **Historical snapshot — not current instructions.** Archived 29 October 2026 from [docs/Root-of-Cambodia-Property-Information-Review.md at 607a705](https://github.com/kimsourly1912/root-of-cambodia/blob/607a7057b908a005f9f3529141b0978f52d24ce0/docs/Root-of-Cambodia-Property-Information-Review.md). Original dates, decisions, PR states and results below are historical.
> **Current authority:** [docs/features/owner-supply.md](../../features/owner-supply.md).
> Historical text is preserved; relative link destinations are adjusted only for relocation. Do not execute old setup or prototype prompts as current guidance.

<!-- historical-body-start -->

# Private property information — review

Date: 29 October 2026. Implementation-plan step 6 remains **in progress**.

PR #13 remains open. This branch starts from `codex/owner-pricing-availability`, commit `21a917d0cf111e2dee98436b2e37142604a317dc`, and targets that branch so this review contains only the information slice. Neither review branch is merged; no deployment was performed.

## Result and boundaries

Owners can open the Information tab of a private property, add a description, address and ordered facility list, save/reopen/edit it, and clear optional values. Khmer and English text are supported. The three property tabs wrap on smaller screens. Empty, unsaved, saving, retry, conflict and unavailable states are real.

| Boundary | Responsibility |
| --- | --- |
| Thin Next.js pages/routes | Existing verified-session, Origin, request-size, cache and diagnostic contracts |
| `property-information.ts` | Normalize bounded text/list values and check current ownership before receipt recovery |
| `property-information-queries.ts` | Owner-scoped reads; absent information returns blank values and an explicit null revision |
| `property-information-persistence.ts` | One complete versioned D1 save, event and receipt; write-time verified owner/draft checks |
| Migration 0008 | Owned information extension and append-only event; immutable identity, monotonic revision and facility-shape guards |

The approved stack, pinned dependencies and lockfile are retained. Routine choices are a separate information row/version, explicit expected absence for a first save, and an ordered free-text facility list. These listing fields do not increment booking-setting revisions or change policy versions. No generic repositories or additional service/database were introduced.

All fields are optional while drafting. Engineering bounds are 5,000 description characters, 1,000 address characters and 30 distinct facility entries of at most 120 characters. Values are trimmed, facility order is retained, and unsupported control/multiline facility entries are rejected. This does not define publication requirements, a standardized amenity taxonomy, verified facility claims, fees or booking policies. Address text is not geocoded or verified; no map provider is selected or contacted.

The atomic save checks current ownership/verification, draft state and the expected information revision (including absence). Competing/stale saves cannot silently overwrite data. A history failure rolls back the data and receipt. Events record the actor and saved version, not historical copies of descriptions/addresses. The UI retains the same body/key after an uncertain response and keeps displayed values with their expected version after refresh. Pending client state lasts only in the open tab; committed information remains readable.

## Fresh local verification

| Check | Result |
| --- | --- |
| Frozen pnpm install, initialization, generated bindings and strict types | Passed; eight authoritative migrations discovered |
| Next.js/OpenNext build and jobs dry-run build | Passed |
| Vitest | 114 passed across 15 files: 109 native D1/runtime, 3 tooling, 2 actual built-Worker journeys; all prior 105 retained |
| Playwright | 10 passed: existing eight checks plus information setup in desktop and phone emulation |

Eight native information scenarios cover canonical fingerprints/receipts, absent/stale/concurrent saves, permission/state races, response-loss recovery, rollback/audit guards, field validation, and unchanged booking settings/snapshots/prices/stock/allocations/notifications. A populated upgrade retains every previous row and original property, room, calendar and booking receipts. Browser checks cover Khmer text, ordered facilities, save/reopen, lost-response retry, stale tabs, clearing optional data, duplicate-list feedback, exact property isolation and cross-owner refusal. Both layouts were inspected with no horizontal overflow.

All results are local and synthetic. Chromium 143 used the documented executable override; matching-browser CI, other engines/real devices, complete accessibility, full Khmer localization and live integrations remain unverified.

## Remaining decisions and work

Photos/media, map location, business contact/arrival information, publication requirements/review and guest/owner booking screens remain. Future guest views need an explicit decision about current versus snapshotted address/arrival information. No public address disclosure or publication operation is introduced here. The technical `unconfigured` terms sentinel remains unsuitable for publication.

Arrival/no-show/late cancellation, infants/age bands, physical-room continuity, external-booking details, admin/support/suspension, provider/domain, reminders, retention and recovery targets stay unresolved. Arrival remains blocked. Existing booking/quote/inventory/calendar operations, public responses/fingerprints and migrations 0001–0007 are unchanged. Staging/deployment remains separately authorized work.
