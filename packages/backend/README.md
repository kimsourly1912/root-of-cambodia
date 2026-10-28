# Root of Cambodia shared backend

This private workspace contains the existing booking/quote/inventory services, scoped queries, named atomic saves, Better Auth factory, Drizzle projections and notification operations. Both runtime apps import explicit package subpaths. The code cannot import Next.js, OpenNext or either app; the workspace boundary test checks that rule.

The step 4 move preserved shared business modules and SQL migrations unchanged. Step 5 subsequently adds safe diagnostics and explicit delivery outcomes; booking/inventory persistence SQL and all migrations remain unchanged. D1 remains one atomic booking/inventory database per environment. A named save still owns its entire operation/receipt batch; do not independently commit its component writes. SQL migrations remain authoritative, and no migration is applied during a request.

Generated worker-configuration.d.ts here contains only the pinned runtime types. Each app separately generates its own environment bindings. This lets the backend typecheck without importing either app's entrypoint. Regenerate all three files from the root with npm run types:bindings.

Use root npm commands. The app and jobs configurations reference this workspace's single migrations directory. No published package, network service, generic table repositories or new database was introduced.

See the [service-boundary review](../../docs/Root-of-Cambodia-Service-Boundaries.md) and [workspace review](../../docs/Root-of-Cambodia-Workspace-Review.md).

The [step 5 contract](../../docs/Root-of-Cambodia-Diagnostics-Delivery-Review.md) documents stable public errors, diagnostic-only guard categories, correlation privacy, and provider acceptance versus inbox delivery. Logging is best-effort and cannot alter operation results.
