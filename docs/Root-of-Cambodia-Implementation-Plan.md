# Root of Cambodia — Architecture Implementation Plan

Date: 28 October 2026
Status: Step 1 (Vitest alignment) is completed locally; see the [verification report](Root-of-Cambodia-Vitest-Alignment.md). Remaining steps are delivery work under the approved application and booking/database designs. The folder layout and workspace tooling below are recommendations for a later implementation change, not changes made by this document.

## 1. Where we are

The project owner has approved:
- One modular Next.js application and one background Worker, sharing business rules.
- D1 initially, Drizzle, Better Auth with verified email, shadcn/ui and payment at the property.
- TypeScript business services calling named atomic database operations.
- Limited database constraints/triggers protecting stock, transitions, snapshots, history and notification outbox.
- Vitest as the main testing direction, with Cloudflare runtime integration and built-Worker/browser verification.

The existing application foundation is useful but does not yet match every approved boundary or test-tool choice. No production behavior or load capacity has been verified.

## 2. Work in small steps

| Step | Plain-language goal | Planned work | Evidence needed before moving on |
| --- | --- | --- | --- |
| 1. Align the test tools — completed locally | Use the agreed test runner without losing our current checks | Validate compatible Vitest/Cloudflare tooling in the current application directory; preserve the baseline scenarios and actual built-Worker harness | All existing D1 scenarios and HTTP checks remain covered and pass; types and bundle checks appropriate to the change |
| 2. Strengthen database safeguards | Close the gaps found in source review | Add failing regressions, then subsequent migrations for supported cancellation cutoff, operation-kind/transition consistency, null identities and valid/coherent instants; improve migration discovery | Targeted regressions pass; fresh/populated upgrade checks retain snapshots, allocations, receipts, history and notifications |
| 3. Separate business and database code | Make the code easier to understand safely | Extract named persistence functions and authorized query functions; keep routes and jobs thin; preserve one booking/inventory transaction | Existing behavior and concurrency/rollback checks remain unchanged and pass |
| 4. Establish shared code and jobs boundaries | Let the website and jobs reuse the same rules | Implement a reviewed workspace/layout change; shared backend cannot import Next.js runtime; jobs cannot duplicate lifecycle SQL | Next.js/OpenNext build, built-Worker checks and jobs-entrypoint integration pass with the new import/binding paths |
| 5. Add clear diagnostics and delivery contracts | Make failures understandable and recoverable | Stable safe error codes, sanitized correlation records, stale-lease regressions; provider acceptance distinguished from inbox delivery | Retry/uncertain-outcome cases remain correct; no private data/tokens in logs; provider-specific behavior remains explicitly unverified until configured |
| 6. Build complete product journeys | Make the foundation usable by owners and guests | Owner setup, rooms/rates/calendar, guest quote/request, owner response and booking detail screens in product order | Browser journeys, accessibility and authorization tests; unresolved policy flows stay blocked |
| 7. Verify real integrations | Check the connected system in a safe environment | Separately authorized staging: D1, HTTPS auth, email, Cron/Queues, monitoring, load and restore drills | Staging evidence and an explicit pilot checklist; local tests alone are insufficient |

Step 1 moves the existing tests before adding new behavior. This addresses the known runner deviation promptly. Step 2 introduces new regressions under the aligned setup rather than expanding the old Node test suite. Work does not require every future product policy to be settled; only the affected flow waits for its missing policy.

Implementation changes should be reviewable PRs with a concrete purpose, relevant evidence and remaining limitations. Do not combine test-tool migration, schema hardening and a broad folder move in one change.

## 3. Recommended code layout for the later organization change

| Proposed location | Responsibility |
| --- | --- |
| apps/web/ | Next.js routes, pages, shadcn/ui components and web runtime adapters |
| apps/jobs/ | Cron/Queue entrypoints and job-runtime adapters |
| packages/backend/src/modules/ | Identity/access, places/properties, inventory/rates, bookings, notifications, media and platform operations |
| packages/backend/migrations/ | One authoritative reviewed SQL migration set, referenced by the relevant Wrangler configurations |
| packages/contracts/ only when actually needed | Browser-safe request/response types or shared validation contracts; no database/runtime secrets or server dependencies |
| docs/ | Product scope, decisions, delivery plans and evidence |
| proofs/foundation/ | Preserved historical standalone fixture, excluded from the active application workspace |

Within a feature module, use clear service, query and persistence files only when the feature needs them. For bookings, named atomic operations own the complete write; table-level repositories must not independently commit pieces of a booking.

Keep web UI components in the web app while there is one web application. Do not create an additional UI package or independent network service without an actual reuse/operational need.

This layout is a recommendation, not a requirement to move all files immediately. Keep application/ intact during steps 1–3. The organization change should preserve behavior and explicitly review Next.js tracing/transpilation, test locations, migrations, environment types, Wrangler paths and compatible web/jobs schema contracts.

## 4. Testing and package tooling

Vitest is the approved runner direction. Cloudflare integration supplies the environment for D1/runtime tests; the Wrangler harness supplies the environment for actual built-application HTTP checks. A harness can be orchestrated in Node without replacing Vitest as the runner. Browser journeys use Playwright.

Use official supported integration guidance and pin a compatible version set. Do not assume old integration package names/configuration still match current documentation. Keep framework/runtime upgrades separate unless required for compatibility, then explain that dependency explicitly.

The current project uses npm; an older draft proposed pnpm. Recommendation: retain npm for the initial test/safety changes, avoiding an unrelated switch. A root npm-workspaces arrangement is a candidate for step 4; the final package-manager/workspace choice is still a tooling decision to document before migration. No npm-to-pnpm switch or lockfile replacement is authorized implicitly by this plan.

Standardize the chosen package-manager version across local instructions and CI when the tooling change is made. The existing npm declaration and the previously observed local npm version differ; report and resolve that discrepancy rather than claiming they are already aligned.

## 5. Permissions and decisions

Routine refactoring, tests and reversible fixes within the approved design can proceed without asking the owner about every filename or helper function. Explain each substantial step in plain language before starting and report its outcome afterward.

Bring material deviations back for agreement: a new database/framework, a different transaction model, changed product rules, paid-service commitments, live deployment or a significant workspace/tooling change outside the documented choice.

Open product decisions remain open: arrival/no-show/late cancellation, infants/age bands, physical-room continuity, external booking details, audited admin support, suspension, provider/domain, reminders, retention and recovery targets. Do not silently encode these while refactoring.

## 6. Current evidence

Step 1 has fresh local verification: 24 D1 scenarios and the 12-check built-Worker journey pass under Vitest (25 reported tests), as do TypeScript and Next.js/OpenNext builds. The [alignment report](Root-of-Cambodia-Vitest-Alignment.md) records the versions, evidence and existing audit finding. Remaining hardening/refactoring/product/staging steps are not completed by those results.

Read the [approved application architecture](Root-of-Cambodia-Architecture.md), [approved booking/database design](Root-of-Cambodia-Booking-Database-Design.md) and [backend review](Root-of-Cambodia-Backend-Foundation-Review.md) for authority, rationale and evidence limits.
