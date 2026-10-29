# Private room-type setup — review

Date: 29 October 2026. Implementation-plan step 6 remains **in progress**.

PR #10 (pnpm) and PR #11 (owner access/property drafts) were merged into main with explicit owner authorization. This change starts from updated main, commit `fabb78e9b2d0b44e98fb8b724f00581e4c8b9f18`, and remains a separate reviewable PR. No deployment was performed.

## What owners can do

Open a private property draft, switch between property details and room types, create a named room type, set the existing per-unit adult/child/total guest limits, and reopen/edit it. Lists are paginated. Empty, saving, unsaved, uncertain-response, stale-edit and unavailable states are real. English working copy and short Khmer labels still need full localization and pilot review.

A room type does not create stock, nightly prices or bookable dates. This slice has no publication, deletion, activation or arrival action.

## Boundaries and decisions

- Thin Next.js pages/routes use the existing verified-session, Origin, JSON-size, private-cache and diagnostic boundary.
- `room-types.ts` normalizes fields and checks access; `room-queries.ts` scopes reads to the owner and exact property/room pair.
- `room-persistence.ts` owns each complete D1 batch: write-time verified ownership/draft-state checks, room changes, revision, event and durable receipt. The existing revision trigger and operation/recovery primitive are reused.
- Additive migration 0006 creates append-only room events linked to actor, operation kind and saved revision. Failed saves retain no room changes, event or success receipt. Events are attributable records, not complete historical room snapshots.

Approved choices are retained: Next.js, Workers/OpenNext, D1/Drizzle, Better Auth, shadcn/ui/Tailwind, Vitest/Playwright and the pinned pnpm workspace. No dependency pins or lockfile change.

Routine implementation choices: restrict this setup endpoint to private drafts, use optimistic revisions, and retain the same request/key after an uncertain response. Completed operations replay their original receipt after later state changes, subject to current authorization. Forms prevent another save while a successful navigation/refresh settles. Pending request state stays in the open tab; closing it loses that client state, while a committed room remains in the room list.

Capacity validation preserves the existing independent adult, child and total ceilings (adult/total 1–100, children 0–100). It does not add a sum-of-maxima rule, infant/age rules, physical-room assignment or an availability policy. Published/high-impact edits remain outside this draft endpoint's scope.

## Fresh local verification

| Check | Result |
| --- | --- |
| Frozen pnpm install, local initialization, generated bindings and strict types | Passed |
| Next.js/OpenNext web build and jobs dry-run build | Passed |
| Vitest | 93 tests across 13 files: 88 native D1/runtime, 3 tooling, 2 actual built-Worker journeys; all prior 84 retained |
| Playwright | 6 passed: existing account/property journeys plus room setup in desktop and phone emulation |

Eight new native room scenarios cover canonical fingerprints/receipts, ownership and exact-parent access, stale/concurrent saves, same-key races, lost responses, write-time revocation, rollback/history guards, validation and pagination. One populated migration upgrade retains every existing row and original property/booking receipts. The browser journey checks real cookie authentication, interrupted-response recovery without duplicates, save/reopen/edit, stale tabs, private API/page access and wrong-parent access. Both layouts were inspected with no horizontal overflow.

Existing booking/inventory/quote operations, snapshots/history/outbox, migrations 0001–0005, dependency pins and lockfile are unchanged. Arrival remains blocked. All results are synthetic local evidence, not production verification. Browser checks used the documented Chromium 143.0.7499.0 override after the matching Playwright download failed; matching-browser CI, real devices, other engines and a full accessibility audit remain unverified.

## Remaining work

Next supply work is prices and dated inventory/calendar setup, followed by photos/media, address/facilities and publication review. Guest request and owner booking screens remain. Do not publish the technical `unconfigured` terms sentinel.

Arrival/no-show/late cancellation, infants/age bands, physical-room continuity, external-booking details, admin/support/suspension, provider/domain, reminders, retention and recovery targets stay unresolved. Live integrations, load and restore checks require separately authorized staging. No new product rule or infrastructure deployment was introduced.
