# Release readiness and recovery

**Status:** not deployable as production configuration; runbook incomplete pending decisions.

**Responsible role:** operations owner (unassigned) (responsibility, not an assigned person).

**Last source verification:** 29 October 2026, [607a705](https://github.com/kimsourly1912/root-of-cambodia/commit/607a7057b908a005f9f3529141b0978f52d24ce0).

**Sources:** [apps/web/wrangler.jsonc](../../apps/web/wrangler.jsonc), [apps/jobs/wrangler.jsonc](../../apps/jobs/wrangler.jsonc), [apps/web/src/runtime.ts](../../apps/web/src/runtime.ts), [apps/jobs/src/runtime.ts](../../apps/jobs/src/runtime.ts), [apps/web/scripts/init-local.mjs](../../apps/web/scripts/init-local.mjs).

This is a readiness/gap record, not an executable deployment authorization. No deploy/provision/migrate commands are prescribed for the current documentation phase. [Status](../status.md) owns current evidence; [open decisions](../product/open-decisions.md) owns approvals.

## Environment and configuration matrix

| Item | Local repository implementation | Staging / production requirement (not yet established) |
| --- | --- | --- |
| Web | OpenNext generated Worker/assets; local APP_MODE and loopback AUTH_URL; workers_dev=false | Separately reviewed environment config/domain/HTTPS/session behavior and fail-closed live-provider path |
| D1 DB | Shared web/jobs local DB identity; one migration directory | Isolated database per environment, reviewed migration ownership/sequence and backup/restore |
| R2 MEDIA | Shared private local bucket, remote:false | Isolated private resource/permissions; originals/previews/cleanup/restore verification |
| IMAGES | Web raw-byte preview processing, remote:false | Real decoder/orientation/animation/metadata/failure/latency fidelity; subscription/quota/cost approval |
| ASSETS | Generated web static assets | Correct deployed Worker/assets and public/private cache boundaries |
| NOTIFICATIONS | Local jobs producer/consumer queue | Isolated queue binding, retries/dead letters, provider idempotency and operator handling |
| Scheduler | Scheduled handler exists; no Cron trigger configured | Approved deployed schedule/invoker, overlap safety, expiry/outbox/cleanup monitoring |
| Auth/notification mail | Local database capture only | Approved domain/provider/credentials, prompt auth-mail recovery, acceptance/bounce/deliverability evidence |
| Observability | Safe application diagnostics and config observability enabled | Actual log access/retention/sampling, redaction, alert thresholds and response owner |

Configuration names are DB, MEDIA, IMAGES, ASSETS, NOTIFICATIONS, APP_MODE and AUTH_URL. BETTER_AUTH_SECRET is a secret; its value is never documentation. Provider-specific secret names are undecided. Binding names are contracts, not evidence that remote resources exist. Changing a Worker name or assigning D1 alone does not remove the deliberate local guard.

## Release gates

Before a separately authorized staging/pilot release:

1. Approve pilot audience/operator/budget/resource ownership (D08), provider/domain/auth-mail/retry contracts (D07), publication/support/terms procedures (D05/D06/D15), arrival and relevant occupancy policy (D01–D04), and user-facing scope.
2. Complete dependency A01 triage/remediation or an explicitly approved bounded exception; define actual required review/check policy (D18).
3. Approve and implement account/action/upload/storage abuse budgets (D11), pending-media/receipt/history retention/access/erasure (D09) and recovery/alerts/exports objectives (D10).
4. Prepare isolated configs/secrets/bindings and a real provider path; keep current guards until the whole path is approved/tested. Never set local mode to disguise a live deployment.
5. Pass frozen install, types, both builds, relevant runtime/HTTP/browser regressions and populated upgrade checks for the exact release tree.
6. Perform authorized real-service smoke, failure/recovery, restore, realistic pilot load and Khmer/mobile/accessibility review. Record exact SHA/config/environment and gates still open.

These are acceptance requirements to implement/verify, not completed procedures or authorization to run remote operations.

## Required staged smoke and failure evidence

Use synthetic accounts/data: signup/verify/reset, HTTPS cookies/session/origin behavior, private access across owners, draft/room/calendar/information/media flows, published listing eligibility under approved review, immutable quote/submission and last-room race, exact deadlines/cancellation, owner responses and agreed arrival path. Demonstrate recurring expiry/outbox/cleanup, queue duplicates/replaced leases, provider timeouts/lost acknowledgements, unavailable recipients and operators recovering overdue work.

Verify live Images decoding/animation/orientation and metadata, storage permissions/private responses, costs/quotas and late-write cleanup. Test guest workflow/attempt reconciliation before claims of a complete booking product. Provider acceptance is not inbox delivery; record verified delivery evidence separately.

## Migration and release sequencing

SQL migrations are the only schema authority. For an approved release, an operator must review a candidate migration against fresh and retained-data upgrades, take/verify the approved recovery checkpoint, and apply it once through a controlled process before incompatible traffic. Record environment, migration IDs, operator and outcome; neither Worker applies migrations on ordinary requests.

The actual remote command/config/credential selection, maintenance window and compatibility/rollback plan remain to be reviewed when a real environment exists. Do not copy the proof's fresh-database reset or local capture tables into production.

## Rollback, restore and operational gaps

A Worker rollback changes code; it does not reverse committed bookings/migrations, recreate deleted R2 originals or undo delivered email. Prefer backward-compatible additive changes. Destructive repair/restore requires explicit authorization and reconciliation of bookings, allocations, receipts/history/outbox and D1/R2 state; do not blindly replay provider messages or delete tombstones.

Before launch, assign an operator and approve RPO (acceptable data loss) and RTO (recovery time), export/checkpoint retention, protected independent copies, access/erasure rules and a timed restore drill. Prove both D1 recovery and media consistency, including late upload writes and notifications emitted around the checkpoint. No successful backup/restore drill is established now.

Monitor request/auth failure and latency, database conflicts/latency/size, pending request expiry lag, outbox age/attempts/lease backlog, provider failures/bounces, pending/removed media and cleanup errors, storage/transform usage and spend. Thresholds, dashboards, escalation/dead-letter ownership and manual replay procedure are **unassigned/unverified**, not fabricated defaults.

## Local troubleshooting boundary

Use [setup](../development/setup.md) for conflicts, missing capture tables/bundles, port 8787 and network problems. Preserve legacy/new local state when reconciling; do not remove data to make a check pass. Nonlocal provider errors are intentional until approved integration, not a request to bypass guards. No production incident procedure can be claimed from a local preview.
