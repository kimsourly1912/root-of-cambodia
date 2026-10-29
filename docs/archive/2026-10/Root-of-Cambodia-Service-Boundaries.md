> **Historical snapshot — not current instructions.** Archived 29 October 2026 from [docs/Root-of-Cambodia-Service-Boundaries.md at 607a705](https://github.com/kimsourly1912/root-of-cambodia/blob/607a7057b908a005f9f3529141b0978f52d24ce0/docs/Root-of-Cambodia-Service-Boundaries.md). Original dates, decisions, PR states and results below are historical.
> **Current authority:** [docs/architecture/overview.md](../../architecture/overview.md), [docs/architecture/database.md](../../architecture/database.md).
> Historical text is preserved; relative link destinations are adjusted only for relocation. Do not execute old setup or prototype prompts as current guidance.

<!-- historical-body-start -->

# Root of Cambodia — Service and Persistence Review

Date: 28 October 2026
Scope: implementation-plan step 3. PR #6 was confirmed merged; this branch starts from main at 0fafbc6, containing safeguards commit 31972e6.

## Outcome

Booking decisions and database saves now have separate places in the code. A service validates the request and its permissions; a named persistence operation saves the complete change. Booking behavior, public responses and the approved stack are retained. Payment remains at the property.

This implements the approved [architecture](Root-of-Cambodia-Architecture.md) and [booking/database design](Root-of-Cambodia-Booking-Database-Design.md). No new architecture, technology or product-policy decision was needed. Filenames, typed function arguments and deferred quote preparation are routine implementation choices within that design.

## Boundaries for maintainers

| Location | Responsibility |
| --- | --- |
| [bookings.ts](../../../packages/backend/src/bookings.ts) | Submission intent, early authorization, fresh quote/hash comparison, reason validation, arrival block and bounded expiry coordination |
| [quotes.ts](../../../packages/backend/src/quotes.ts) | Canonical selection, dates, occupancy, complete nightly coverage, charges, totals and the unchanged quote hash |
| [inventory.ts](../../../packages/backend/src/inventory.ts) | Inventory input validation and early verified-owner checks |
| [access.ts](../../../packages/backend/src/access.ts) | Existing verified, guest/owner-scoped Drizzle booking detail read; extracted resource checks and trusted due-request discovery |
| [quote-queries.ts](../../../packages/backend/src/quote-queries.ts) | Internal catalog reads, published/owned-property scope and active property-room scope; called after service verification |
| [booking-persistence.ts](../../../packages/backend/src/booking-persistence.ts) | commitRequest, commitBookingTransition and expireRequest; complete snapshot/transition batches and receipts |
| [inventory-persistence.ts](../../../packages/backend/src/inventory-persistence.ts) | editInventoryNight; conditional versioned update, attributable event and receipt in one batch |
| [operations.ts](../../../packages/backend/src/operations.ts) | Retained verified-user query and operation primitive: fingerprint, key scope, transactional execution, assertions, stored receipt and uncertain-outcome recovery |

HTTP routes and jobs.ts remain thin adapters calling the same services. outbox.ts retains its existing named publication/delivery operations and fenced delivery batches. Delivery-contract changes belong to step 5. application/ stays in place; no workspace migration, generic table repositories or live jobs wiring is introduced.

The lifecycle save accepts only supported commands, never arbitrary SQL or a client-supplied target status. Arrival remains excluded.

Endpoints derive actors from sessions. Services verify and scope resources before persistence, including replay. Internal resource/catalog helpers require that verified service context; raw D1 access remains trusted infrastructure.

## Consistency and compatibility review

- Each named save calls the existing operate primitive once. Its operation record, guarded writes, trigger-managed effects, success receipt and final assertion remain one D1 batch. No table write was moved into an independent commit.
- SQL statement order, bindings, write-time authorization, deadlines, revisions and zero-row guards are retained. All 30 SQL/policy string fragments match the merged baseline.
- Existing constraints/triggers still own allocation/release, immutable snapshots, matching commands, history and mandatory notification records. All four applied migrations are unchanged.
- Online/external submissions retain kind=submit, normalized fingerprints, scoped keys, stored receipts and the quote snapshot/hash format.
- Quote preparation stays deferred until after receipt lookup. Authorized retries return the original result even when current catalog data cannot form a new quote.
- An old acceptance receipt still describes that operation after cancellation; booking details show the current state.
- Routes, transport protections, authentication, runtime settings, dependency pins, npm lockfile and historical tests are unchanged. No new production dependency is introduced.

## Local verification

Verification used Linux, Node 24.22.1, npm 11.9.0, Vitest 5.0.5 and @cloudflare/vitest-plugin 1.4.9, with synthetic records and local workerd/D1.

| Check | Result |
| --- | --- |
| Fresh npm ci | Passed with the existing lockfile |
| Native Workers/D1 suite | 60 passed: all 52 retained scenarios plus 8 boundary regressions |
| Combined npm test | 61 passed across six files: 60 D1 scenarios plus the rebuilt-Worker journey |
| Rebuilt Next.js/OpenNext Worker | Existing 12 HTTP checks passed within that journey |
| Local migration runner | All four existing migrations applied on a fresh local database; existing populated upgrade/rejection scenarios also passed |
| Generated binding types and TypeScript | Passed; generated bindings unchanged |
| Next.js/OpenNext build | Passed using the current pinned versions |
| Formatting, documentation links and whitespace | Passed |

Eight added scenarios cover fingerprint/receipt compatibility after catalog/state changes, permission revocation before replay, and verification/ownership revocation immediately before submission, acceptance or inventory saves. Rejections leave booking/stock/receipt/history/outbox counts unchanged. All historical tests remain intact.

These are local results, not production verification. The earlier [OpenNext dependency audit finding](Root-of-Cambodia-Vitest-Alignment.md) remains unresolved; dependencies were not upgraded in this refactor.

## Remaining decisions and next step

Arrival, late arrival, no-show and cancellation after scheduled check-in remain unresolved. check_in still returns arrival_policy_decision_required; no inferred arrival path was added. Infant/age definitions, detailed party distribution, physical-room continuity, external guest/contact/negotiated-price/consent contracts, audited admin/support access and suspension procedures remain open.

Provider/domain, auth-mail reliability, reminder timing, retention/erasure, receipt retention, operator recovery and restore targets remain open. Remote D1, HTTPS auth, live Cron/Queues, provider behavior, load, monitoring and restore drills require separately authorized staging work. No infrastructure was deployed and no pull request was merged by this task.

Step 3 is complete locally and ready for review. Step 4 is next: agree the concrete workspace/jobs layout and tooling decision before making the broader move. Step 5 diagnostics/delivery contracts and complete product journeys remain later work.
