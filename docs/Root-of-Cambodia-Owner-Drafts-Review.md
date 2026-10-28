# Owner access and private property drafts — review

Date: 28 October 2026. Implementation-plan step 6 is **in progress**. This is its first owner/supply slice, not the complete product or a production release.

## Result and scope

Owners can register, verify email, sign in/out, request another verification link, reset a password, and create, reopen and edit their own private property drafts. The responsive shadcn/ui/Tailwind screens have real empty, saving, retry, conflict and unavailable states. Khmer names and short labels use bundled Noto Sans Khmer fonts; the English working copy still needs a complete Khmer localization and pilot-user review.

PR #10 remains open, so this branch is based on `codex/pnpm-workspace`. Review the pnpm conversion there; review only owner-draft changes here. No PR is merged and nothing is deployed.

## Boundaries and decisions

| Boundary | Responsibility |
| --- | --- |
| Next.js pages/components | Forms, private server rendering, saved/unsaved state and recovery prompts |
| Thin route adapters | Existing session, verified-email, Origin, JSON-size, cache and diagnostic contract; new creation returns 201 |
| `property-drafts.ts` | Bounded field normalization and current access checks, including receipt replay |
| `property-queries.ts` | Own-property projections and bounded keyset pagination; no client-supplied owner identity |
| `property-persistence.ts` | One complete D1 batch per create/edit, through the existing fingerprint/receipt/recovery primitive |
| Migration 0005 | Attributable, append-only draft events tied to the verified owner, operation kind and saved revision |

Approved decisions: existing Next.js/Workers/D1/Drizzle/Better Auth stack, shadcn/ui/Tailwind, verified email, accounts that can be both guest and owner, multiple owned properties, and the requested pnpm workspace. No additional framework, database or package manager was introduced.

Routine choices: reuse the existing place/property draft state; create the owner profile on the first save without silently renaming an existing profile; use optimistic revisions to reject stale tabs. New drafts have no rooms and cannot be booked. The technical `unconfigured` terms version does not record acceptance of platform terms. Owners enter their own arrival/departure times and house rules; no platform arrival/cancellation rule or default time is inferred. Published/review/paused editing is outside this draft endpoint's scope.

Every save commits profile/catalog/property changes, revision, draft event and receipt together. A failure rolls everything back. The UI retains the same request/key after an uncertain response, freezes changes while recovering, and prevents another save while successful navigation/refresh settles. Pending form/key state is held in the open tab; closing it loses that pending client state. A committed draft remains discoverable in the owner's property list. Events record actor/action/revision, not full historical copies of draft contents.

Existing booking/inventory services, fingerprints, atomic SQL, snapshots, history/outbox and migrations 0001–0004 remain unchanged. The HTTP helper's optional success status defaults to the existing 200. The arrival endpoint remains blocked.

## Verification

| Local check | Observed result |
| --- | --- |
| Fresh pnpm install and frozen-lockfile validation | Passed; all 493 prior locked artifacts retained, 46 added |
| Local initialization and generated bindings, including after a build | Passed with all five authoritative migrations |
| Separate workspace/test TypeScript checks | Passed |
| Next.js/OpenNext web build and jobs dry-run build | Passed |
| `pnpm test` | 84 tests across 12 files: 79 native D1/runtime, 3 tooling, 2 actual built-Worker journeys; all prior 77 retained |
| `pnpm test:browser` | 4 passed: two real journeys in desktop and phone-sized Chromium |

Seven new native scenarios cover own-resource/verified-actor boundaries, immutable events, parallel/stale saves, rollback of all rows/receipts, same-key races, lost commit responses, validation and pagination. Populated migration upgrades retain every previous row and booking receipt while adding an empty draft-history table. Browser journeys exercise captured email links, unverified rejection, password reset, create/edit/reopen, lost-response replay without a duplicate, stale-tab refusal, cross-origin/missing-key refusal, cross-owner page/API isolation and sign-out. Desktop/mobile screenshots were inspected with no horizontal overflow.

All evidence is local and synthetic. The browser harness uses the actual built OpenNext Worker and isolated D1, real cookie sessions and captured authentication links. Its loopback-only mail reader is in the test process, not an application route or deployed bundle. No real email is sent.

Playwright is pinned at 1.64.1. This environment used an explicit Chromium 143.0.7499.0 executable from the temporary `@sparticuz/chromium@143.0.0` tool after the matching browser download was unavailable. The repository defaults to Playwright's matching browser; repeat with that browser in CI. Desktop and phone viewports are emulations, not real-device or cross-browser certification. Visible desktop/mobile layouts were inspected; semantic labels/statuses drive the journeys. This is not a complete accessibility audit.

## Remaining work and decisions

Rooms, photos/media, facilities/address/map, prices/calendar, publication review, public discovery and guest/owner booking screens remain step 6 work. First-property review still precedes publication; this slice exposes no publication operation. Publication must replace the technical terms sentinel with configured approved terms. Complete Khmer copy, keyboard/screen-reader review and pilot usability checks remain.

Arrival, no-show, late cancellation, infants/age bands, physical-room continuity, external booking details, admin/support/suspension, provider/domain, reminders, retention and recovery targets stay explicit unresolved decisions. Live email/HTTPS auth, real D1/Cron/Queues, load and restore checks require separately authorized staging. Local capture adapters remain fail-closed outside local mode.
