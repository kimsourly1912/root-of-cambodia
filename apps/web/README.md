# Web application

**Status:** current package boundary; evidence in canonical status.

**Responsible role:** package maintainer (responsibility, not an assigned person).

**Last source verification:** 29 October 2026, [607a705](https://github.com/kimsourly1912/root-of-cambodia/commit/607a7057b908a005f9f3529141b0978f52d24ce0).

**Sources:** [apps/web/package.json](package.json), [server/http.ts](server/http.ts), [server/runtime.ts](server/runtime.ts), [feature structure](../../docs/architecture/feature-structure.md).

Next.js/React UI and thin OpenNext/Workers HTTP/runtime adapters, organized by feature: `app/` holds thin routes, `features/<feature>/` holds each feature's components (and `server.ts` adapters), and `components/`, `lib/` and `server/` hold code shared by two or more features. Pages use authorized reads; browser mutations call backend services. Keep booking rules and atomic SQL out of adapters.

Read [owner supply](../../docs/features/owner-supply.md), [bookings](../../docs/features/bookings.md), [architecture](../../docs/architecture/overview.md) and [status](../../docs/status.md). Local auth mail is captured, not sent; runtime deliberately rejects nonlocal mode.

Use root commands from [setup](../../docs/development/setup.md) and [testing](../../docs/development/testing.md), including both Worker builds before the full suite. The same setup page covers previews, private verification links and legacy-state handoff. The local [UI MIT notice](components/ui/LICENSE.md) remains in place.

No publication, live-service or production readiness follows from this preview. [Release gates](../../docs/operations/release-and-recovery.md) apply.
