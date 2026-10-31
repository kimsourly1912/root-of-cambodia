# Notification delivery and diagnostics

**Status:** implemented local capture/recovery contracts; live provider and reminders unconfigured.

**Responsible role:** backend/operations maintainer (responsibility, not an assigned person).

**Last source verification:** 29 October 2026, [607a705](https://github.com/kimsourly1912/root-of-cambodia/commit/607a7057b908a005f9f3529141b0978f52d24ce0).

**Sources:** [packages/backend/migrations/0002_booking_operations.sql](../../packages/backend/migrations/0002_booking_operations.sql), [packages/backend/src/shared/outbox.ts](../../packages/backend/src/shared/outbox.ts), [packages/backend/src/features/jobs/jobs.ts](../../packages/backend/src/features/jobs/jobs.ts), [apps/jobs/src/index.ts](../../apps/jobs/src/index.ts), [apps/jobs/src/runtime.ts](../../apps/jobs/src/runtime.ts), [packages/backend/src/shared/diagnostics.ts](../../packages/backend/src/shared/diagnostics.ts), [apps/web/server/runtime.ts](../../apps/web/server/runtime.ts).

## Event authority, recipients and non-goals

A committed booking transition creates attributable booking_event and notification_outbox rows in the same transaction. Current SQL creates recipient records for the booking guest (when present) and property owner; external reservations have no online guest account. The durable booking record is authoritative. Notification failure must not undo the booking or silently lose the event.

The current provider captures synthetic messages in local_notification; auth verification/reset URLs are separately captured in local_email. Neither sends email. Planned owner/arrival reminders, production templates/provider/domain, bounce/complaint webhooks and operator/dead-letter procedures are not implemented by these contracts. The booking outbox does not already solve prompt auth-mail delivery/recovery.

## Publication, leases and results

Queue bodies carry only `{id}`, not guest details or email content. IDs can embed recipient references, so they must not be logged raw. A bounded sweep republishes due pending records and expired sending leases; there is no permanent “published” bit that could lose work after an enqueue timeout.

A consumer claims eligible work with a unique token and five-minute lease, records an attempt and resolves the recipient's **currently verified email**. Only the matched token can acknowledge/retry the outbox row. An older worker may record its own attempt but cannot overwrite a newer lease or claim its completion.

| Outcome | Meaning |
| --- | --- |
| not_claimed | No eligible claim; provider was not called |
| retry_scheduled | Failure or unavailable recipient recorded durably under current lease |
| provider_accepted | This provider call succeeded and its matched lease committed acknowledgement |
| lease_superseded | This invocation cannot acknowledge/reschedule another worker's lease |

Every result has `inboxDelivery: unknown`. providerAccepted describes that invocation's successful provider call. Legacy delivered boolean is true only when matched acknowledgement committed; persisted delivered/delivered_at/provider_id names mean **provider acceptance**, never inbox delivery.

Failures return the row to pending with delay `min(3600, 30 * (1 << min(attempts, 6)))` seconds. Provider attempts reuse the outbox ID as idempotency key. Provider success followed by uncertain D1 acknowledgement remains recoverable after lease expiry; no exactly-once inbox guarantee is claimed. A live adapter needs timeouts shorter than the lease and a verified deduplication window.

## Jobs adapter

Scheduled maintenance expires up to 50 requests, publishes up to 50 outbox records and sweeps removed-photo objects. Queue input must be an object with a string id <=200 characters. Invalid messages, duplicate/no-claim outcomes, accepted delivery and durably stored backoff are acknowledged. Uncertain database failures request retry with the same ID. Due-work/expired-lease sweeps remain responsible for recovery.

Outside APP_MODE=local, jobs fails before acknowledgements/business writes. Web also admits exact-origin staging-read-only and staging-test. The latter permits private fictional account logins and existing business services, but mail-dependent endpoints and live/capture delivery remain refused. Test outbox events remain pending. See [staging scope](../operations/staging.md). No deployed Cron schedule is configured. A successful dry-run or queue fixture is not operational scheduling evidence. See [jobs README](../../apps/jobs/README.md).

## Safe diagnostics

Application HTTP adapters add a server-generated X-Request-Id on success/error. JSON failures retain `{error: code}` and safe statuses; unknown/corrupt errors become 503 temporarily_unavailable_retry_same_key. Guard categories are internal hints, not proof that a save failed. Better Auth endpoints retain the library's handler contract.

The allowlisted diagnostic sink emits version/source/correlationId/event/code and optional safe reason/status/opaque reference. It omits raw errors/stacks/SQL/URLs/query/body/cookies/tokens/keys/lease tokens/guest contact/actor and booking IDs/provider IDs. Queue correlation uses a namespaced SHA-256 digest plus fresh per-invocation reference. Best-effort sink failure cannot change operation success. Scheduled exceptions use fixed safe messages, not raw provider/database failures.

JSON endpoint completion diagnostics use the actual configured success status (200 or 201); media reads retain 200 and scheduled completion records omit HTTP status. Operational metadata still needs access/retention/volume review; library/platform logs need staging inspection.

## Verification and open operations

Regressions include missed publication, duplicates, unavailable verified recipients, provider failure, expired/replaced leases, old worker success/failure, lost acknowledgement and diagnostic privacy. Actual built-jobs tests exercise scheduled expiry and local queue delivery; [testing](../development/testing.md) and [status](../status.md) establish limits/results.

D07 covers sender/domain/provider, current-email changes/recovery and reminder timing. Ownership transfer/support recipient contracts need explicit design/tests before implementation. D09/D10 cover retention, failure ownership, alert thresholds, retry/dead-letter recovery and restore. No maximum-attempt/terminal-failure operator policy is inferred from capped backoff. See [release/recovery](../operations/release-and-recovery.md).
