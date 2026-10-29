> **Historical snapshot — not current instructions.** Archived 29 October 2026 from [docs/Root-of-Cambodia-Architecture.md at 607a705](https://github.com/kimsourly1912/root-of-cambodia/blob/607a7057b908a005f9f3529141b0978f52d24ce0/docs/Root-of-Cambodia-Architecture.md). Original dates, decisions, PR states and results below are historical.
> **Current authority:** [docs/architecture/overview.md](../../architecture/overview.md), [docs/architecture/decisions/0001-modular-monolith.md](../../architecture/decisions/0001-modular-monolith.md).
> Historical text is preserved; relative link destinations are adjusted only for relocation. Do not execute old setup or prototype prompts as current guidance.

<!-- historical-body-start -->

# Root of Cambodia — Approved Application Architecture

Tooling amendment (28 October 2026): the owner subsequently selected pnpm workspaces; see the [pnpm migration review](Root-of-Cambodia-Pnpm-Workspace-Review.md). Earlier npm references are historical.

Implementation update (28 October 2026): the exact [workspace plan](Root-of-Cambodia-Workspace-Plan.md) was subsequently approved and implemented locally. apps/web and apps/jobs reuse packages/backend through private npm workspaces. The [step 4 review](Root-of-Cambodia-Workspace-Review.md) is the current local evidence; earlier counts/paths below are historical.

Decision date: 28 October 2026
Status: Overall architecture and the separately reviewed [booking/database design](Root-of-Cambodia-Booking-Database-Design.md) are approved by the project owner. Implementation follows the [delivery plan](Root-of-Cambodia-Implementation-Plan.md); pending tooling/layout and product decisions remain explicit.
Scope: Direction for application organization and delivery. This decision does not authorize deployment, purchases, or changes to unresolved product policies.

## 1. What we agreed, in plain language

Build one organized application, with clear business departments, and one background worker. Keep the same booking rules available to both. Start with one D1 database per environment and measure its capacity before making growth claims.

This approach is called a **modular monolith**: the main application stays together while code is grouped by business responsibility. The background worker runs scheduled and delivery work. Shared business code is a library used inside both applications, not another network service.

| Part | Responsibility | Selected direction |
| --- | --- | --- |
| Web application | Guest website, owner dashboard, admin area and HTTP endpoints | Next.js App Router, React, TypeScript, shadcn/ui and Tailwind |
| Shared business code | Authorization, quotes, booking rules, inventory operations and notification contracts | Framework-independent TypeScript where practical; explicit adapters for persistence/providers |
| Database | Identity, ownership, catalog, bookings, nightly stock, history and durable notification records | One Cloudflare D1 database initially per environment; Drizzle and reviewed SQL |
| Background worker | Expiry, notification delivery/retries and scheduled maintenance | Small Cloudflare Worker, Queues and Cron |
| Media | Controlled uploads, private originals and deliberate image delivery/variants | R2 and Cloudflare Images |
| Authentication | Email/password, verified email and server-side sessions | Better Auth |
| Payment | Guest pays the property | No platform payment processing |

Upstream Next.js uses the existing OpenNext hosting path. Adapter compatibility and staging behavior remain verification requirements. This decision does not introduce a separate guest backend, owner backend or Hono API server.

## 2. Business modules and boundaries

| Module | Owns | Important boundary |
| --- | --- | --- |
| Identity and access | Session adaptation, verification checks, ownership/permission checks | A session identifies the caller; every protected operation must authorize its own resource |
| Places and properties | Listings, destinations, property ownership, publication and pause state | Public reads expose approved fields; owner edits are property-scoped |
| Rooms, rates and inventory | Room options, prices, nightly capacities and blocks | Allocation counters are controlled by the booking transaction path |
| Bookings | Quotes, requests, acceptance, decline, expiry, cancellation and stay lifecycle | Booking and inventory changes for one operation commit together |
| Notifications | Durable notification records, templates, provider adaptation and retries | Delivery failure cannot undo an accepted booking |
| Media | Upload authorization, asset records and image lifecycle | Browsers do not receive unrestricted storage credentials or access to private originals |
| Platform operations | Moderation, reports and approved support workflows | Admin privilege is not routine owner impersonation; sensitive access must be explicitly authorized and audited |

Modules expose explicit operations and read functions. A module must not reach into another module's private implementation or independently commit part of a shared booking operation. Shared transactions are coordinated through one booking/inventory persistence boundary.

Do not make a generic shared folder the owner of unrelated business rules. Extract a helper only when it has a clear responsibility and useful reuse.

## 3. Code responsibilities

An HTTP endpoint or Server Action receives input, derives the caller from the server session, applies transport protections and calls a business operation. It does not duplicate prices, booking transitions or allocation rules.

A business service coordinates permissions, validation, rules and persistence. Pure rules should remain testable without Next.js request objects.

Database code owns query details and atomic persistence. Ordinary operations may use Drizzle. Booking-critical SQL, constraints and bounded triggers follow the approved detailed design; an ORM does not replace the atomicity guarantee. Source-review hardening and runtime verification remain required.

Server-rendered pages may call authorized read services directly instead of making HTTP requests to the application's own endpoints. Browser mutations use thin HTTP endpoints initially, matching the current foundation. Any future Server Actions must call the same services and enforce their own authentication/authorization.

Use straightforward typed functions. Introduce interfaces at real boundaries such as email providers and database operations; do not require abstract classes, generic repositories or extra layers for every table.

## 4. Booking consistency and background work

Acceptance must commit the booking transition, every requested room/night allocation, attributable history and notification outbox together. Cancellation must release only committed, unreleased allocations. A zero-row or rejected transition must not create success side effects.

The **outbox** is the database's durable list of notifications still needing delivery. Save it in the same transaction as the booking change. Send email after commit.

The jobs Worker uses the same lifecycle and persistence operations as the web application. Cron finds due work; queue messages identify delivery work. Overlapping runs and duplicate messages must be safe. Missed publication, expired delivery leases and uncertain provider acknowledgements must remain recoverable.

Acceptance checks the authoritative deadline itself. A delayed expiry job must never allow late acceptance. Booking confirmation is not delegated to an eventually delivered email/queue job.

The [approved detailed design](Root-of-Cambodia-Booking-Database-Design.md) defines the transaction/trigger boundaries, receipt semantics and migration authority. Implement its hardening work in subsequent tested changes; design approval is not evidence that those changes are already complete.

## 5. Growth and operational boundaries

Start with one D1 database per environment so all writes for one booking stay together. Optimize indexed queries, bounded reads/writes and background work before introducing database partitioning or additional network services.

Use deliberate caching for suitable public listing data and versioned images. Keep private booking/session responses out of shared caches. Treat booking-time availability and prices as authoritative database checks.

D1 has finite storage and per-database throughput. Establish a realistic pilot workload, measure performance and monitor growth before promising a supported user/property count. Keeping code organized does not remove database limits.

If measurements justify a different database layout or database technology, prepare a separate architecture decision. Partitioning and migration are substantial changes: shared booking transactions, identity, reporting and D1-specific SQL/triggers need redesign/verification. They are not assumed to be drop-in changes.

Local, staging and production must have separate resources, secrets, auth settings and appropriate test data. Staging, live email/jobs, monitoring, restore drills, load testing and recovery objectives remain release gates.

## 6. Testing and delivery direction

| Test layer | Purpose | Approved direction |
| --- | --- | --- |
| Business rules | Dates, prices, occupancy and individual rules | Vitest |
| Database integration | Migrations, constraints, snapshots, atomic operations and races | Vitest with a compatible Cloudflare Workers integration |
| Built application | Actual Next.js/OpenNext routes, cookies, authorization and bundled runtime | Wrangler test harness; use an explicit integration with the chosen runner |
| Browser journeys | Guest and owner behavior across complete screens | Playwright; React Testing Library where useful |

Preserve existing regression scenarios during migration. Validate the exact Vitest/Cloudflare versions and runtime compatibility before replacing the current runner. The Wrangler harness provides the built-Worker environment; it is not a competing choice of business-rule test runner.

The application now uses Vitest for 24 native Workers/D1 tests and one Node-orchestrated built-Worker journey retaining all 12 HTTP checks. This is 25 Vitest tests across four files. The [alignment report](Root-of-Cambodia-Vitest-Alignment.md) records fresh local evidence and scope. Node remains a development/orchestration runtime, not a replacement test runner.

One repository and a consistent lockfile/tooling policy are required. The current application/proof use npm; the older technical plan proposed pnpm. Package-manager choice, exact workspace paths and migration order need an explicit tooling decision before changing them. This architecture approval does not silently switch the package manager.

Future pull-request checks should cover formatting/lint, types, relevant tests, builds and Worker compatibility. Apply migrations through one controlled process; never run competing schema systems on live requests. Do not rewrite migrations that have already been applied; evolve them with reviewed subsequent migrations.

## 7. Current implementation versus approved target

| Area | Current state | Follow-up |
| --- | --- | --- |
| Repository/application | application/ contains a Next.js backend foundation; proofs/foundation/ is historical | Plan a small, reviewable organization change after detailed design decisions |
| Shared modules | Several services exist in application/src/ | Establish module APIs and web/jobs boundaries without changing behavior accidentally |
| Booking persistence | Native D1 batches, constraints, triggers and receipts are locally tested | Detailed direction is approved; implement source-review hardening and clear persistence boundaries |
| Jobs and providers | Shared functions/interfaces exist; live wiring is absent | Review entrypoint contracts and choose providers/settings separately |
| Test tooling | Vitest alignment passes locally with native Workers tests and the built-Worker harness | Preserve coverage while adding the approved database regressions |
| Screens and supply setup | Full owner/guest/admin interfaces are absent | Build complete flows after architecture alignment |
| Live verification | No authorized deployment from this decision | Prepare staging work separately when requested |

The recorded local results are 24 D1 tests, 12 built-Worker checks, TypeScript and Next.js/OpenNext builds. This documentation change does not rerun them or convert them into production evidence. See the [backend review](Root-of-Cambodia-Backend-Foundation-Review.md).

## 8. Decisions still open

- Detailed booking/database direction is settled; concrete migrations, runtime implementation and verification remain delivery work rather than open architectural choices.
- Workspace/tooling is settled by the approved step 4 plan: native npm workspaces, npm 11.9.0, Node 24.22.1 and retained pinned dependencies. Future reorganizations/upgrades still need their own review.
- Arrival, late arrival, no-show and cancellation after scheduled check-in.
- Child/infant definitions, detailed party distribution and physical-unit continuity.
- External reservation contact fields, negotiated prices and consent records.
- Audited support/admin access, stronger admin authentication and suspension procedures.
- Provider/domain, auth-mail reliability, reminders, queue operations and recovery targets.
- Data retention/erasure, backup/restore procedures, pilot sizing and load expectations.

## 9. Next step and change control

Next, follow the [implementation plan](Root-of-Cambodia-Implementation-Plan.md): Vitest alignment is complete locally; strengthen the identified safeguards, then extract named persistence functions. Review exact workspace/layout changes before a broad move. This documentation update itself makes no runtime changes.

The project owner should not need to discover missing engineering steps. Explain the current phase, the next action and any material decision before substantial work. Continue routine implementation within approved choices; bring material changes to architecture, technologies, product policy, costs or deployment back for agreement.

This record is authoritative for overall architecture where older technical drafts differ. The product plan remains the scope/policy authority. Historical evidence must keep its original limits; unresolved policies are not inferred from code or merged pull requests.
