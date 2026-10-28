# Root of Cambodia — Approved Booking and Database Design

Date: 28 October 2026
Status: Detailed approach approved by the project owner on 28 October 2026. Implementation and verification remain separate work.
Baseline reviewed: main at 67bec618133d17e3c21ac8a55f22e097c461e002, following merged architecture PR #3.

Implementation update: [Vitest alignment](Root-of-Cambodia-Vitest-Alignment.md) is now completed locally, including configured migration discovery/tracking. Source-review observations below describe the original baseline; other database hardening remains pending.
Change scope: Design and source review only. No runtime, schema, dependency or infrastructure changes are made by this proposal.

The [overall architecture](Root-of-Cambodia-Architecture.md) is approved. This document records the separately approved decision: how booking operations safely update the database and where that code belongs. The [implementation plan](Root-of-Cambodia-Implementation-Plan.md) defines the next delivery steps and distinguishes pending tooling/layout recommendations.

## 1. The recommendation in plain language

Keep booking rules in understandable TypeScript services. Give every booking change one named database operation that saves all required records together. Keep a limited, documented set of database constraints and triggers to protect stock, snapshots, valid transitions and mandatory history/notification writes.

A **transaction** is an all-or-nothing save. A **constraint** rejects an invalid record. A **trigger** automatically performs a defined database action when a row changes. Neither sends email or calls an outside service.

This keeps the locally tested foundation while making its responsibilities clearer. It also accepts a real tradeoff: some important behavior lives in SQL, so changes require migration review and database integration tests. Moving to another database later would require deliberate work.

## 2. Example: two requests for the last room

Illustrative stay: 20–22 November 2026, occupying the nights of 20 and 21 November; checkout on 22 November consumes no night. Each request asks for one room for two adults at USD 35 per night plus an illustrative USD 5 per-stay charge: USD 75 total, paid at the property.

There is one room available on each occupied night. Both guest requests A and B are Pending. Pending requests do not reserve stock. An owner accepting one request does not guarantee the other can also be accepted.

| Record | Before acceptance | If A successfully commits first | When B then attempts acceptance |
| --- | --- | --- | --- |
| A booking | Pending | Confirmed | Unchanged |
| B booking | Pending | Pending | Still Pending; acceptance conflicts |
| 20 November stock | 0 reserved / capacity 1 | 1 reserved / capacity 1 | Remains 1 |
| 21 November stock | 0 reserved / capacity 1 | 1 reserved / capacity 1 | Remains 1 |
| A allocations | None | One recorded allocation per occupied night | Unchanged |
| Confirmation history/outbox | None | A confirmation history and intended notifications saved | No B confirmation side effects |
| Operation receipt | None | A's original result saved for retry recovery | No success receipt for B's refusal |

The same requirement applies if the second night is missing/blocked, the request has expired, or the actor is unauthorized: the attempted operation must not leave partial status, allocation, history, notification or success-receipt writes.

Whichever valid acceptance commits first can win. The design does not promise click order or fairness. A stock conflict does not automatically decline B; the owner can refresh availability and follow the existing decline/expiry/cancellation flows. No new product policy is inferred.

The booking is confirmed by the database result. Email delivery follows afterward and is not the source of truth.

## 3. Practical alternatives

| Option | Advantages | Costs/risks | Recommendation |
| --- | --- | --- | --- |
| D1 batch with bounded transition triggers and constraints | Reuses the tested approach; allocation/release and required audit/outbox follow a valid transition in the same transaction | More SQL behavior to understand; trigger changes must be reviewed as carefully as service changes | Recommended for this foundation |
| D1 batch with explicit side-effect statements in the persistence function, retaining constraints/guards | More of the write sequence is visible in TypeScript-built SQL | Every side effect needs correct transition/operation guards; removing existing triggers requires a careful conversion and equivalent regression evidence | Viable alternative, but no demonstrated benefit yet justifies replacing the existing approach |

Both can be correct. A batch alone is not enough: an UPDATE affecting zero rows is not automatically an error, so a careless later statement could still run. Both options must explicitly bind all effects to an actual permitted transition and roll back when required work is absent.

A sequence of independently committed reads/writes does not satisfy the agreed booking contract. Adding a separate booking server or coordination service would not remove the need for database consistency and is not proposed.

## 4. Who owns each responsibility

| Part | Responsibility | Must not do |
| --- | --- | --- |
| Next.js endpoint / Server Action | Parse bounded input, obtain session identity, enforce transport protections and call a named operation | Calculate independent prices, choose client-supplied identity/roles or directly change stock/status |
| Booking service | Coordinate the use case, validate intent, authorize the resource, prepare/recheck server quote, map safe results/errors | Split a single booking save into separately committed repository calls |
| Atomic booking persistence functions | Own the D1 batch, authoritative write-time checks, receipts and named transitions; coordinate inventory and booking writes | Expose arbitrary CRUD operations that let callers bypass the required transaction |
| Constraints and bounded triggers | Protect relationships, numeric values, immutable snapshots, legal transitions, allocation/release and atomic history/outbox | Send email, call providers, run broad unrelated workflows or infer unresolved product policy |
| Authorized read functions | Return scoped booking details and permitted public catalog data; use Drizzle where useful | Make private records readable because a UI layout was protected |
| Jobs entrypoints | Call shared expiry/delivery operations in bounded work units | Reimplement lifecycle rules or mutate bookings through a second path |
| Notification delivery | Claim recoverable work, send after commit, record attempts/retry state | Undo a booking because email failed |

Proposed named persistence functions include commitRequest, acceptRequest, declineRequest, cancelRequest, expireRequest, recordExternalReservation and editInventoryNight. Names describe the contract; a generic repository per table is not required.

The coordinated booking/inventory write remains one transaction in one database even though code is grouped by feature. Inventory's public module API cannot independently increment/decrement reservation counters.

## 5. What stays in SQL, and why

Keep ordinary relationships and numeric rules as constraints: valid references, one room/date calendar row, integer quantities/money, and reserved + blocked <= capacity.

Keep database-enforced protection for:
- Immutable submitted booking/room/night/charge snapshots.
- Legal lifecycle transitions and attributable operation context.
- Complete nightly coverage and total reconciliation at submission.
- Write-time expiry and supported cancellation guards.
- All-night allocation/release, including missing inventory rejection.
- Mandatory append-only history and notification outbox linked to the real transition.

Keep product orchestration, helpful validation errors, transport handling and provider/template logic in TypeScript. Early application checks improve the response; critical conditions that may change before commit are rechecked in the transaction.

Document each trigger's input, affected tables, failure codes and related tests. Do not depend on unspecified ordering among separate triggers. Validation failure must roll back earlier writes whichever trigger happens to execute first. BEFORE triggers should validate/reject rather than modify the row being changed; side effects belong in carefully reviewed AFTER triggers.

This is a recommendation for a bounded set of critical effects, not approval to put future business workflows into database triggers without review.

## 6. Submission, snapshots and schema ownership

The server computes prices and policies from the current database; the client supplies its selection and the quote hash it reviewed. Submission recalculates that quote and rejects changes requiring another review. Inside the atomic batch, version/ownership/publication/availability checks prevent a stale read from being committed.

The internal building state is a construction boundary used only within that batch. A submitted request becomes Pending with a database submission time, a 12-hour deadline and no stock hold. The response is exposed only after the snapshot and receipt commit. Future import/admin tools must use an explicit reviewed path rather than standalone building inserts.

Keep the existing stable room lines, occupied-night prices and itemized per-stay charge snapshots. Preserve the quoted names, guest contact snapshot, dates, UTC instants, Cambodia timezone, arrival/departure times, occupancy/capacities, terms/policies and total. Later catalog changes do not rewrite the accepted record.

SQL migrations remain the deployment authority, including triggers and constraints. Drizzle remains part of the selected stack for typed queries/mappings; the current schema.ts is intentionally a partial read projection, not a complete second schema authority. Add checks for mappings used by services as they expand.

Run one controlled migration process. Better Auth-generated changes must be reviewed and incorporated into it. Do not run runtime auto-migrations or schema push against live requests. Add subsequent migrations rather than editing already-applied files. Test fresh installs and upgrades with retained data.

## 7. Retries and uncertain outcomes

Use an actor-scoped operation key and normalized request fingerprint. The operation receipt is saved with the booking change. Same actor/key/payload returns the original successful receipt; a different payload using that key conflicts. Authorization is rechecked even when replaying a result.

A receipt answers **what happened to that operation**. It is not a claim that the booking still has that status now. For example, replaying an old successful acceptance may return Confirmed even after a later cancellation. The UI must refresh the current authorized booking record.

If a write times out, look up its receipt. If that lookup also fails, report that the outcome cannot yet be confirmed and retry the same operation key. Do not assume the write failed, invent a new booking or issue a new key automatically. Add bounded backoff/jitter for retryable transient failures, not automatic retries for every business conflict.

Proposed first-version semantics retain successful receipts; definite refusals do not receive success receipts. A later explicit user attempt after a business refusal should have a new key. This matches the current success-receipt model; it does not promise cached refusal responses forever. Receipt cleanup requires an approved retention/retry policy.

## 8. Notifications and operational recovery

A committed transition saves its history and outbox rows. Queue messages carry the outbox ID. A scheduled sweep republishes due rows and expired sending leases, so losing the first publication does not lose the notification.

A consumer claims a lease with a unique token. Only that token may update the outbox result, preventing an older worker from overwriting a newer lease. Attempts, failures and retries remain visible. Every provider attempt reuses the same outbox idempotency key.

The current five-minute lease and capped backoff are technical defaults, not verified provider guarantees. Select provider timeouts shorter than the lease with suitable margin, verify the provider's actual deduplication window and record provider acceptance separately from inbox delivery/bounce outcomes. Do not promise exactly-once inbox delivery.

Existing delivery resolves the recipient account's currently verified email; booking contact snapshots are separately retained. Account email changes, ownership transfer, sensitive support recipients and dead-letter/operator handling need explicit contracts/tests before those workflows are added. Auth verification/reset email reliability also needs its own prompt-delivery/recovery contract; it is not already solved by the booking outbox.

## 9. Findings from the current source review

These are static source observations and proposed follow-up work, not newly reproduced failures or evidence of a public exploit.

| Observation | Why it matters | Proposed follow-up |
| --- | --- | --- |
| Service functions currently construct D1 statements directly | Booking orchestration and persistence are mixed, making future callers harder to constrain | Extract named atomic persistence functions while preserving behavior and tests |
| Core acceptance/allocation/outbox operations already share a batch/transition | The foundation contains useful tested behavior | Preserve it rather than rewrite solely for a folder convention |
| Cancellation cutoff is in transition() SQL, but the transition trigger does not enforce that cutoff | A future trusted import/admin writer could bypass the service guard | Add defense-in-depth checks for currently supported pre-check-in cancellations; keep late policy unresolved |
| Transition actor checks validate role/resource but do not constrain operation.kind to the matching transition | Future internal code could attach misleading command context | Define/check the allowed command-to-transition mapping, including an explicit restricted import path |
| Booking instant CHECK expressions compare date(...) to a date without an explicit non-null conversion check | SQLite CHECK can pass a null expression; malformed trusted imports deserve stronger validation | Add explicit valid-instant/non-null checks and consistency between snapshotted date/time/instant |
| Several business IDs use TEXT PRIMARY KEY without explicit NOT NULL | SQLite can permit null primary-key values for ordinary non-integer primary keys; service-generated IDs currently avoid this, but future imports need stronger guarantees | Add explicit non-null identity checks with populated-data migration tests |
| Drizzle mappings cover only selected read columns | They must not be mistaken for the whole migration schema | Keep SQL authority explicit and test mappings as modules add queries |
| Tests hardcode three migration filenames and use a custom SQL splitter | A future migration can be accidentally omitted or parsed differently from real application | Use a configured migration loader/runner with migration tracking; keep explicit upgrade baselines |
| Most constraint errors become generic booking_conflict | Safe externally, but insufficiently precise for debugging and some UI cases | Map known errors to stable safe codes; record sanitized diagnostics and correlation IDs without guest data |
| Outbox delivered currently means provider.send returned successfully | Provider acceptance is not proof of inbox delivery | Name/document the distinction; add provider webhook/bounce contracts when a provider is selected |
| Existing race/deadline tests cover a finite set of local cases | They do not establish all timing cases, load capacity or provider behavior | Add the targeted tests below and later staged verification |

Any required table rebuild must be designed as a populated-data migration: preserve relationships, triggers, snapshots, history and receipts. Replacing a table by dropping it without reviewing dependent objects and retention protection is not an acceptable shortcut.

## 10. Verification and implementation sequence

1. Record the accepted detailed design and its boundaries; this approval is now recorded.
2. Align the existing scenarios with compatible Vitest/Workers tooling in the current directory before adding new behavior. Validate exact versions and preserve the real built-Worker harness.
3. Add targeted regressions, then small subsequent migration fixes for invariant gaps; remove hardcoded/custom migration-loading drift.
4. Extract atomic persistence functions in small behavior-preserving changes; routes and jobs call the same operations.
5. Agree the exact shared-code layout/workspace tooling before a broad move; keep the earlier safety changes separate.
6. Re-run types, relevant D1/upgrade tests, Next.js/OpenNext build and actual built-Worker checks as appropriate to each change.
7. With separately authorized staging work, test real D1, HTTPS sessions, queues, sending provider, failure recovery, observability and load.

Required targeted cases include:
- Timeout before commit, after commit, and during receipt recovery; repeat after a later booking cancellation.
- Verification/ownership revoked between early checks and commit, and before replay.
- Every protected transition with zero affected rows, wrong operation kind, or missing required history/outbox work.
- Competing accept/cancel/expire/external/block edits across multiple rooms and a later-night failure.
- Supported cancellation cutoff at the exact boundary through the database command path.
- Null business identities, invalid/null-converting instants, date/time consistency, immutable snapshot insertion after sealing and incomplete/gapped multi-line quotes.
- An old delivery worker finishing after its lease was replaced, provider success with lost acknowledgement, failed publication and failed-recipient recovery.
- Fresh installation and populated upgrade through the same discovered migration set used for the application.

The earlier 24 D1 tests, 12 built-Worker checks and builds remain historical local evidence for the baseline. This proposal does not rerun them, migrate the runner, make code changes or claim production verification.

## 11. Approved decision and scope

The project owner approved retaining **TypeScript business services + named atomic D1 persistence operations + bounded database constraints/triggers + transactional history/outbox**, with the source-review hardening and regression work above addressed in subsequent implementation PRs.

This approval settles the detailed persistence direction. It does not settle arrival/no-show/late-cancellation policies, child/infant definitions, physical-unit continuity, admin/support scope, provider/domain, retention, package manager, exact folder layout, or authorize live deployment. Routine implementation within this design does not require repeated approval of individual files/functions.

## References checked

- [D1 batches and transactional rollback](https://developers.cloudflare.com/d1/worker-api/d1-database/)
- [D1 foreign-key enforcement](https://developers.cloudflare.com/d1/sql-api/foreign-keys/)
- [D1 retry guidance](https://developers.cloudflare.com/d1/best-practices/retry-queries/)
- [SQLite triggers and RAISE behavior](https://www.sqlite.org/lang_createtrigger.html)
- [SQLite CHECK null semantics](https://www.sqlite.org/lang_createtable.html#check_constraints)
- [Queues delivery guarantees](https://developers.cloudflare.com/queues/reference/delivery-guarantees/)

These sources establish platform behavior; the chosen design and follow-up priorities are project recommendations.
