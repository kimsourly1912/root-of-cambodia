# Root of Cambodia - Architecture Implementation Plan

Date: 28 October 2026; progress updated 29 October 2026
Status: Steps 1-5 are completed locally. Step 6 is in progress with owner access, private property/room setup, pricing/availability, information and private photos. The [photo review](Root-of-Cambodia-Property-Photos-Review.md) records 131 passing Vitest tests and 12 browser checks with local emulators in GitHub CI. Earlier-step evidence remains below. Staging and deployment remain separately authorized.

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
| 1. Align the test tools - completed locally | Use the agreed test runner without losing our current checks | Validate compatible Vitest/Cloudflare tooling in the current application directory; preserve the baseline scenarios and actual built-Worker harness | All existing D1 scenarios and HTTP checks remain covered and pass; types and bundle checks appropriate to the change |
| 2. Strengthen database safeguards - completed locally | Close the gaps found in source review | Add failing regressions, then subsequent migrations for supported cancellation cutoff, operation-kind/transition consistency, null identities and valid/coherent instants; improve migration discovery | Targeted regressions pass; fresh/populated upgrade checks retain snapshots, allocations, receipts, history and notifications |
| 3. Separate business and database code - completed locally | Make the code easier to understand safely | Extract named persistence functions and authorized query functions; keep routes and jobs thin; preserve one booking/inventory transaction | Existing behavior and concurrency/rollback checks remain unchanged and pass |
| 4. Establish shared code and jobs boundaries - completed locally | Let the website and jobs reuse the same rules | Implement a reviewed workspace/layout change; shared backend cannot import Next.js runtime; jobs cannot duplicate lifecycle SQL | Next.js/OpenNext build, built-Worker checks and jobs-entrypoint integration pass with the new import/binding paths |
| 5. Add clear diagnostics and delivery contracts - completed locally | Make failures understandable and recoverable | Stable safe error codes, sanitized correlation records, stale-lease regressions; provider acceptance distinguished from inbox delivery | Retry/uncertain-outcome cases remain correct; no private data/tokens in logs; provider-specific behavior remains explicitly unverified until configured |
| 6. Build complete product journeys - in progress | Make the foundation usable by owners and guests | Owner setup, rooms/rates/calendar, guest quote/request, owner response and booking detail screens in product order | Browser journeys, accessibility and authorization tests; unresolved policy flows stay blocked |
| 7. Verify real integrations | Check the connected system in a safe environment | Separately authorized staging: D1, HTTPS auth, email, Cron/Queues, monitoring, load and restore drills | Staging evidence and an explicit pilot checklist; local tests alone are insufficient |

Step 1 moves the existing tests before adding new behavior. This addresses the known runner deviation promptly. Step 2 introduces new regressions under the aligned setup rather than expanding the old Node test suite. Work does not require every future product policy to be settled; only the affected flow waits for its missing policy.

Implementation changes should be reviewable PRs with a concrete purpose, relevant evidence and remaining limitations. Do not combine test-tool migration, schema hardening and a broad folder move in one change.

## 3. Workspace layout - approved and implemented locally

PR #7 is merged. The owner approved the [step 4 workspace plan](Root-of-Cambodia-Workspace-Plan.md) in conversation on 28 October 2026. Step 4 first introduced apps/web, apps/jobs and packages/backend using npm workspaces. The subsequent owner decision moved the active workspace to pnpm and one root pnpm lockfile. Shared source initially retains its tested filenames; no future modules/contracts/UI packages were created.

| Approved location | Responsibility |
| --- | --- |
| apps/web/ | Next.js routes, pages, shadcn/ui components and web runtime adapters |
| apps/jobs/ | Cron/Queue entrypoints and job-runtime adapters |
| packages/backend/src/ | Identity/access, places/properties, inventory/rates, bookings, notifications, media and platform operations |
| packages/backend/migrations/ | One authoritative reviewed SQL migration set, referenced by the relevant Wrangler configurations |
| packages/contracts/ only when actually needed | Browser-safe request/response types or shared validation contracts; no database/runtime secrets or server dependencies |
| docs/ | Product scope, decisions, delivery plans and evidence |
| proofs/foundation/ | Preserved historical standalone fixture, excluded from the active application workspace |

Within a feature module, use clear service, query and persistence files only when the feature needs them. For bookings, named atomic operations own the complete write; table-level repositories must not independently commit pieces of a booking.

Keep web UI components in the web app while there is one web application. Do not create an additional UI package or independent network service without an actual reuse/operational need.

application/ was retained through steps 1-3 and migrated in step 4 after explicit approval. Web/jobs import shared package subpaths. The framework-independent backend and all four migrations moved unchanged; Next.js tracing/transpilation, migration/test paths, generated bindings and local-state handoff were verified. See the [workspace review](Root-of-Cambodia-Workspace-Review.md).

## 4. Testing and package tooling

The owner subsequently requested pnpm explicitly. The active workspace now uses pnpm 12.15.0, pnpm-workspace.yaml, workspace:* links and one root pnpm-lock.yaml. This supersedes the earlier npm choice described below, not the application architecture. The [pnpm migration review](Root-of-Cambodia-Pnpm-Workspace-Review.md) records artifact preservation and fresh checks. Step 6 now begins with the separately reviewable owner-access/private-draft slice described above.

Vitest is the approved runner direction. Cloudflare integration supplies the environment for D1/runtime tests; the Wrangler harness supplies the environment for actual built-application HTTP checks. A harness can be orchestrated in Node without replacing Vitest as the runner. Browser journeys use Playwright.

Use official supported integration guidance and pin a compatible version set. Do not assume old integration package names/configuration still match current documentation. Keep framework/runtime upgrades separate unless required for compatibility, then explain that dependency explicitly.

The earlier step 4 decision approved npm 11.9.0 with Node 24.22.1 and native npm workspaces. One root lockfile controls the active application; proofs/foundation remains independent. All 506 third-party package lock entries retain their versions, integrities and resolutions. Current pinned framework/runtime/test dependencies remain unchanged; no workspace orchestrator was added.

## 5. Permissions and decisions

Routine refactoring, tests and reversible fixes within the approved design can proceed without asking the owner about every filename or helper function. Explain each substantial step in plain language before starting and report its outcome afterward.

Bring material deviations back for agreement: a new database/framework, a different transaction model, changed product rules, paid-service commitments, live deployment or a significant workspace/tooling change outside the documented choice.

Open product decisions remain open: arrival/no-show/late cancellation, infants/age bands, physical-room continuity, external booking details, audited admin support, suspension, provider/domain, reminders, retention and recovery targets. Do not silently encode these while refactoring.

## 6. Current evidence

PRs #13/#14 are merged at main `3dd6fb1ebcf52e2e0a33fe000dd2432cdf027ed7`. PR #15 starts there on `codex/private-property-photos`. Upload journalling, private processing/previews, ordering/removal and recoverable cleanup are implemented and verified using local Cloudflare emulators in GitHub CI: frozen pnpm install, nine migrations, bindings, strict types, both builds, all 131 Vitest tests and 12 desktop/phone browser checks pass. All earlier 114 Vitest and ten browser checks are retained. PC dependency installation remains network-blocked; real services are unverified. See the [photo review](Root-of-Cambodia-Property-Photos-Review.md). Step 6 remains in progress: map/contact/arrival information, publication requirements/review and guest/owner booking screens remain. Arrival stays blocked. No merge or deployment was performed.

The next information slice is based on still-open PR #13 and reviewed separately. It adds private descriptions, addresses and ordered facility lists with their own versioned atomic save/history, without changing booking-setting revisions. Fresh local checks pass 114 Vitest tests and ten desktop/mobile browser checks, frozen installation, populated/fresh migrations, bindings, strict types and both builds. See the [property-information review](Root-of-Cambodia-Property-Information-Review.md). Photos/media, map/contact/arrival information, publication requirements/review and booking screens remain; no merge or deployment is implied.

PR #12 was subsequently merged with explicit authorization. The pricing/availability slice starts from updated main in a separate branch. It adds seven-night views, whole-cent USD prices, total/blocked unit setup, read-only reserved counts and one atomic versioned save for selected dates. Public draft gating and booking snapshots/allocations are preserved, including when a reservation arrives during editing. The [pricing/availability review](Root-of-Cambodia-Pricing-Availability-Review.md) records 105 Vitest tests, eight browser checks and local verification limits. Media, publication readiness/review and booking screens remain; step 7/staging is still separate.

On 29 October, PR #10 and PR #11 were merged into main with explicit authorization. The next room-type slice starts from that updated main on its own branch. It adds private room create/edit/reopen, exact-property authorization and append-only room events without creating availability or changing booking rules. Fresh checks pass 93 Vitest tests and six desktop/mobile browser checks, frozen installation, migrations, generated bindings, strict types and both builds. See the [room-type review](Root-of-Cambodia-Room-Types-Review.md). Prices/calendar, media, publication and booking screens remain step 6 work; staging remains separate.

The first step 6 slice implements verified owner access and private property draft create/edit/reopen. Field validation, own-resource queries, atomic draft saves, append-only events and optimistic revisions preserve the established service/persistence boundaries. Fresh local checks pass 84 Vitest tests and four desktop/mobile browser checks, generated bindings, strict types and both builds. The [owner-draft review](Root-of-Cambodia-Owner-Drafts-Review.md) records version/evidence limits. The rest of step 6 remains open; no publication, merge or deployment is implied.

Step 5 has fresh local evidence: 77 tests pass across eleven files (72 native D1/runtime cases, three workspace checks and two built-Worker journeys). All 69 prior tests remain. Stable public error codes/bodies are retained, with server-generated X-Request-Id and allowlisted diagnostic records. Notification outcomes distinguish provider acceptance, retry and a superseded lease; inbox delivery stays unknown. Native/built tests cover stale workers, uncertain receipts and diagnostic privacy. Typechecks and both builds pass. Migrations, booking/inventory SQL and dependencies remain unchanged. See the [diagnostics/delivery review](Root-of-Cambodia-Diagnostics-Delivery-Review.md). Step 6 complete product journeys is next; no deployment or merge was performed.

Step 4 has fresh local evidence: 69 Vitest tests pass (64 D1/runtime scenarios, three workspace/handoff checks and two built-Worker journeys). All 60 prior D1 scenarios and the web journey's 12 HTTP checks remain. The jobs journey loads its actual prebuilt bundle and exercises scheduled expiry and local queue delivery. Fresh root/proof installs, generated bindings, separate typechecks and both builds pass. Migrations and shared business modules are byte-identical after the move. See the [workspace review](Root-of-Cambodia-Workspace-Review.md). Step 5 was subsequently implemented locally as recorded above; no deployment or merge was performed.

Step 3 extracts named booking/inventory persistence operations and scoped query functions within application/. Services retain validation and authorization; routes and jobs continue to call them. All 52 existing D1 tests are preserved; eight added boundary regressions bring the D1 suite to 60. Combined npm test passes 61 tests, including the rebuilt Worker's existing 12 HTTP checks. Fresh local migration installation, populated upgrades, TypeScript and Next.js/OpenNext builds pass. Migrations, dependency pins, npm lockfile and public responses are retained. See the [service-boundary review](Root-of-Cambodia-Service-Boundaries.md). Step 4 was subsequently approved and implemented as recorded above. This is local evidence; no deployment or merge is authorized by these results.

Step 2 adds migration 0004 and regression-backed guards. Fresh installation, populated upgrades, rollback on incompatible legacy records and existing retry/history continuity pass locally. The combined suite passes 53 Vitest tests: 52 D1 scenarios plus the 12-check built-Worker journey. TypeScript and Next.js/OpenNext builds pass. See the [safeguards review](Root-of-Cambodia-Database-Safeguards.md). Step 3 is now completed locally as recorded above. No remote infrastructure was deployed or verified.

Step 1 recorded local verification: 24 D1 scenarios and the 12-check built-Worker journey pass under Vitest (25 reported tests), as do TypeScript and Next.js/OpenNext builds. The [alignment report](Root-of-Cambodia-Vitest-Alignment.md) records the versions, evidence and existing audit finding. The later refactoring/product/staging steps are not completed by those results.

Read the [approved application architecture](Root-of-Cambodia-Architecture.md), [approved booking/database design](Root-of-Cambodia-Booking-Database-Design.md) and [backend review](Root-of-Cambodia-Backend-Foundation-Review.md) for authority, rationale and evidence limits.
