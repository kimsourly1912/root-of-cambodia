# Local jobs Worker

**Status:** current package boundary; evidence in canonical status.

**Responsible role:** package maintainer (responsibility, not an assigned person).

**Last source verification:** 29 October 2026, [607a705](https://github.com/kimsourly1912/root-of-cambodia/commit/607a7057b908a005f9f3529141b0978f52d24ce0).

**Sources:** [apps/jobs/package.json](package.json), [apps/jobs/src/index.ts](src/index.ts), [apps/jobs/src/runtime.ts](src/runtime.ts).

Scheduled and queue adapters call shared backend expiry/delivery operations. Scheduled maintenance also sweeps removed-photo tombstones through MEDIA. Do not duplicate lifecycle SQL in this app.

[Notifications](../../docs/features/notifications.md) defines acknowledgements, retries, leases and provider-acceptance semantics. [Owner supply](../../docs/features/owner-supply.md) defines cleanup limits. Local capture sends no real email; outside local mode jobs fails before business writes/acknowledgements. No live Cron schedule is configured.

Use root [setup](../../docs/development/setup.md) and [testing](../../docs/development/testing.md). Both web and jobs builds are required before the full suite. The jobs build is Wrangler dry-run output; it does not deploy. Previews share root local state; init:local owns migration application.

See [status](../../docs/status.md) and [release/recovery](../../docs/operations/release-and-recovery.md); these local adapters are not deployable production configuration.
