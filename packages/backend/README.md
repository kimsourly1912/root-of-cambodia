# Shared backend

**Status:** current package boundary; evidence in canonical status.

**Responsible role:** package maintainer (responsibility, not an assigned person).

**Last source verification:** 29 October 2026, [607a705](https://github.com/kimsourly1912/root-of-cambodia/commit/607a7057b908a005f9f3529141b0978f52d24ce0).

**Sources:** [packages/backend/package.json](package.json), [src/shared/operations.ts](src/shared/operations.ts), [feature structure](../../docs/architecture/feature-structure.md), [packages/backend/migrations/](migrations).

Private TypeScript workspace for business services, authorized reads, named atomic D1 persistence, auth/notification contracts and diagnostics. Code lives in `src/features/<feature>/` around the `src/shared/` kernel. Apps and scripts import one entry per feature (`@root-of-cambodia/backend/<feature>` or `/shared`); backend must not import Next.js/React/OpenNext or either app.

The [architecture module map](../../docs/architecture/overview.md#module-map) describes entrypoints. Persistence modules are not exported, so app adapters can only call services and authorized reads. The tooling test enforces cross-feature imports and the layer order.

[Database rules](../../docs/architecture/database.md) govern complete operation/receipt batches, immutable snapshots/history, SQL schema authority and additive migrations. Drizzle schema is a partial read projection. [Bookings](../../docs/features/bookings.md), [owner supply](../../docs/features/owner-supply.md) and [notifications](../../docs/features/notifications.md) own detailed contracts.

Use root [setup](../../docs/development/setup.md) and [testing](../../docs/development/testing.md); types:bindings generates shared runtime and separate app environment declarations. This package is a library, not a published package or another network service. See [status](../../docs/status.md) for evidence.
