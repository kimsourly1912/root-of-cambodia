> **Historical snapshot — not current instructions.** Archived 29 October 2026 from [apps/jobs/README.md at 607a705](https://github.com/kimsourly1912/root-of-cambodia/blob/607a7057b908a005f9f3529141b0978f52d24ce0/apps/jobs/README.md). Original dates, decisions, PR states and results below are historical.
> **Current authority:** [apps/jobs/README.md](../../../../apps/jobs/README.md), [docs/status.md](../../../status.md), [docs/development/setup.md](../../../development/setup.md).
> Historical text is preserved; relative link destinations are adjusted only for relocation. Do not execute old setup or prototype prompts as current guidance.

<!-- historical-body-start -->

# Root of Cambodia local jobs Worker

The scheduled and queue entrypoints import the same private backend operations as the website. They contain no booking lifecycle SQL. Configuration is local-only; no Cron schedule or remote resources were provisioned.

From the repository root, run pnpm install --frozen-lockfile, pnpm run init:local, pnpm run types:bindings, pnpm run build:jobs and pnpm test. preview:jobs and preview:worker both use root .wrangler/state and the same local D1 database ID. Only init:local owns migration application; neither Worker migrates on requests.

The scheduled handler runs shared maintenance (bounded expiry and outbox publication). The queue handler calls shared consume. Success, duplicates, invalid messages and durably stored backoff are acknowledged; uncertain database failures request a retry with the same outbox ID. Superseded workers cannot report delivery completion or reschedule a newer lease. The adapter logs stable safe result codes and hashed notification references, never raw recipient-bearing IDs, tokens or errors. Scheduled exceptions are replaced with fixed safe messages before rethrowing. Due work and expired leases remain sweepable. Detailed live retry/dead-letter operations remain a later decision.

The scheduled handler also calls bounded removed-photo cleanup through its `MEDIA` R2 binding, sharing the same local bucket as web. Removal tombstones retain both derived paths; failures and attempts are counted and reswept, including after successful deletion to catch late upload writes. No abandoned-upload expiry or retention/erasure policy is inferred. No live Cron schedule is configured; physical cleanup waits for maintenance. See the [photo review](../Root-of-Cambodia-Property-Photos-Review.md).

The provider inserts into local_notification, created by local initialization. It sends no real email. Its stable key deduplicates capture after lost acknowledgements. A missing table is treated as provider failure by the existing durable retry path. Outside APP_MODE=local, handlers fail before any acknowledgement or business writes. Do not deploy this capture configuration as production.

build:jobs uses Wrangler deploy with --dry-run solely to create dist output; it performs no deployment. The built jobs journey loads that output through Wrangler's prebuiltWorkerDir harness. Other jobs tests exercise the actual exported handlers with controlled failures in native workerd/D1.

See the [workspace review](../Root-of-Cambodia-Workspace-Review.md) for evidence and unresolved release gates.

Provider acceptance is not inbox delivery. Explicit outcomes and the legacy delivered-field interpretation are documented in the [diagnostics/delivery review](../Root-of-Cambodia-Diagnostics-Delivery-Review.md); inboxDelivery remains unknown.
