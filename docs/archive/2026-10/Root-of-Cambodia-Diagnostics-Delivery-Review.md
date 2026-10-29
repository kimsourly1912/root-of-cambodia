> **Historical snapshot — not current instructions.** Archived 29 October 2026 from [docs/Root-of-Cambodia-Diagnostics-Delivery-Review.md at 607a705](https://github.com/kimsourly1912/root-of-cambodia/blob/607a7057b908a005f9f3529141b0978f52d24ce0/docs/Root-of-Cambodia-Diagnostics-Delivery-Review.md). Original dates, decisions, PR states and results below are historical.
> **Current authority:** [docs/features/notifications.md](../../features/notifications.md).
> Historical text is preserved; relative link destinations are adjusted only for relocation. Do not execute old setup or prototype prompts as current guidance.

<!-- historical-body-start -->

# Root of Cambodia — Diagnostics and Delivery Review

Date: 28 October 2026
Scope: implementation-plan step 5, following owner instruction to proceed. PR #8 was confirmed merged before starting from updated main at 6096a41b7b1d85b067314acc097d31cf4da73aee.

## Outcome

Application failures now have safe diagnostic codes and a server-generated reference. Notification results explicitly distinguish provider acceptance, retry and a superseded worker lease. Booking rules, authorization, atomic saves, response bodies, fingerprints and stored receipts remain compatible. The approved stack, dependency pins, lockfile and migrations are unchanged; payment remains at the property.

## Failure and correlation contract

| Boundary | Implemented behavior |
| --- | --- |
| Application HTTP endpoints | Existing success/error bodies and statuses remain; X-Request-Id is added on both success and failure |
| Request references | Generated UUID per request, independent of client-supplied headers, URLs, cookies and idempotency keys |
| Public error codes | Existing codes are enumerated/typed; unrecognized or corrupted errors fall back to temporarily_unavailable_retry_same_key / 503 |
| Database guard failures | Preserve booking_conflict / 409 after receipt recovery; add an internal category for recognized inventory, snapshot, deadline or actor guards |
| Unknown/uncertain failures | Stay uncertain; no diagnostic classification claims that the write failed or invents a new retry key |
| Jobs | Emit safe scheduled/queue result records; uncertain database outcomes still retry the same notification ID |

[errors.ts](../../../packages/backend/src/errors.ts) defines the stable code/status vocabulary. Database categories are hints based on recognized guard labels, not a complete explanation of every refusal. Conditional zero-row writes and unnamed numeric constraints can still report the generic database_guard_rejected category. Early verification/ownership checks and write-time database guards remain authoritative.

[diagnostics.ts](../../../packages/backend/src/diagnostics.ts) emits only version, source, correlationId, event, code, optional reason/status and an opaque reference. It does not copy raw errors, causes, stacks, SQL, paths, query strings, request bodies, guest contact details, actor/booking IDs, provider IDs, cookies, credentials, idempotency keys or lease tokens. Notification IDs contain recipient references, so queue correlation uses a namespaced SHA-256 digest instead of the raw ID. This reference is stable across retries; each invocation also has a fresh UUID.

The console sink is synchronous and best-effort: a sink exception cannot change a successful save or queue outcome. Scheduled failures rethrow a fixed safe error instead of forwarding raw queue/database exceptions into runtime exception logs. The existing failed-publication test now expects jobs_maintenance_failed rather than the raw queue error, while retaining its recovery/expiry assertions. Nonlocal jobs still fail closed with the same safe configuration message.

Correlation is operational metadata, not anonymous analytics or an authorization mechanism. Access, retention, sampling/volume and platform/auth-library logging still require staging review. The new request/header contract covers application endpoints; Better Auth's own endpoints retain the library's handler contract.

## Notification contract and lease fix

A successful Provider.send response means the configured adapter accepted the attempt. It is not proof of inbox arrival. The current adapter only captures local synthetic messages. No sender/provider, webhook, bounce or complaint integration was selected or provisioned.

| Delivery result | Meaning |
| --- | --- |
| not_claimed | This invocation did not acquire eligible work; it did not call a provider |
| retry_scheduled | Failure/recipient unavailability was recorded under the current lease with existing durable backoff |
| provider_accepted | Provider acceptance was recorded and this lease committed the outbox acknowledgement |
| lease_superseded | Another worker owns or completed the work; this invocation cannot claim completion or reschedule it |

Every delivery result includes inboxDelivery=unknown. providerAccepted describes only this invocation's successful provider call. The legacy delivered boolean remains for callers, but is true only after a matched lease commits acceptance. Persisted state/outcome names delivered, delivered_at and provider_id remain unchanged for compatibility; they record provider acceptance, not verified inbox delivery. New callers should use the explicit outcome.

The existing SQL already fenced outbox updates by lease token. Previously, an older successful worker could still return delivered=true after its update affected zero rows. The acknowledgement/retry updates now RETURN their matched row, making that result explicit. Attempts retain their own token-attributed history; an older attempt can record its acceptance/failure without changing the newer worker's outbox state. Each attempt/outbox pair remains one D1 batch. Booking transactions are untouched.

Stable provider keys, publication sweeps, expired-lease recovery, backoff and queue acknowledgements remain. Provider acceptance followed by a lost database acknowledgement is still uncertain and recoverable; exactly-once inbox delivery is not promised.

## Fresh local verification

Linux, Node 24.22.1 and npm 11.9.0, with the existing pinned Vitest/Workers integration and synthetic data.

| Check | Result |
| --- | --- |
| Fresh root npm ci | Passed with unchanged lockfile/dependencies |
| Separate web/jobs/backend/test typechecks | Passed |
| Native Workers/D1 tests | 72 passed: all 64 prior scenarios plus eight targeted diagnostics/delivery cases |
| Combined npm test | 77 tests across eleven files passed; all 69 previous scenarios retained |
| Actual rebuilt web Worker | All 12 original HTTP checks retained; request/log references, spoofed-header rejection, safe unknown-error 503 and diagnostic privacy assertions passed |
| Actual rebuilt jobs Worker | Scheduled/queue integration and safe provider-acceptance records passed |
| Next.js/OpenNext and local jobs builds | Passed; jobs build uses Wrangler dry-run only |
| Migration/booking/lockfile scope | Applied migrations, booking/inventory SQL, fingerprint/receipt construction and lockfile unchanged |
| Formatting, whitespace and documentation links | Passed |

The eight new cases cover late success after a newer acknowledgement, late failure during a newer active lease, recipient recovery, diagnostic allowlisting/sink failure, a genuine native guard category, and timeouts before/after commit with failed receipt lookup. Both timeout cases recover with the same operation key without duplicate allocations. Built-Worker tests inspect the actual emitted records, not a separate logging implementation.

## Remaining decisions and next step

Step 5 is complete locally and ready for review. Step 6 is next: build complete product journeys, beginning with owner/supply setup under the product plan. Full UI/browser journeys remain unimplemented.

Arrival stays blocked. No-show, late cancellation, infant/age definitions, detailed party distribution, physical-room continuity, external contact/negotiated-price/consent and admin/support policies remain open. No rule was inferred from this work.

Provider/domain, auth-mail reliability, reminders, inbox/bounce evidence, live retries/dead letters, retention, load, monitoring and restore targets remain open. Remote D1, HTTPS/auth, Cron/Queues and provider behavior need separately authorized staging work. The existing OpenNext dependency audit finding remains. No deployment, real email or pull-request merge was performed.

References: [D1 batches](https://developers.cloudflare.com/d1/worker-api/d1-database/), [Queues delivery guarantees](https://developers.cloudflare.com/queues/reference/delivery-guarantees/) and [Workers console](https://developers.cloudflare.com/workers/runtime-apis/console/). These support the mechanisms; local results do not certify production behavior.
