> **Historical snapshot — not current instructions.** Archived 29 October 2026 from [packages/backend/README.md at 607a705](https://github.com/kimsourly1912/root-of-cambodia/blob/607a7057b908a005f9f3529141b0978f52d24ce0/packages/backend/README.md). Original dates, decisions, PR states and results below are historical.
> **Current authority:** [packages/backend/README.md](../../../../packages/backend/README.md), [docs/status.md](../../../status.md), [docs/development/setup.md](../../../development/setup.md).
> Historical text is preserved; relative link destinations are adjusted only for relocation. Do not execute old setup or prototype prompts as current guidance.

<!-- historical-body-start -->

# Root of Cambodia shared backend

Private draft photos use `media.ts`, authorized `media-queries.ts` and named atomic saves in `media-persistence.ts`. Migration 0009 journals identities before R2 writes and guards gallery revisions/membership, removal tombstones and history. D1/R2 do not share a transaction. See the [photo review](../Root-of-Cambodia-Property-Photos-Review.md) for recovery boundaries and passing CI verification with local emulators. Live retention/expiry, costs and publication remain unresolved.

This private workspace contains the existing booking/quote/inventory services, scoped queries, named atomic saves, Better Auth factory, Drizzle projections and notification operations. Both runtime apps import explicit package subpaths. The code cannot import Next.js, OpenNext or either app; the workspace boundary test checks that rule.

The step 4 move preserved shared business modules and SQL migrations unchanged. Step 5 subsequently adds safe diagnostics and explicit delivery outcomes; booking/inventory persistence SQL and all migrations remain unchanged. D1 remains one atomic booking/inventory database per environment. A named save still owns its entire operation/receipt batch; do not independently commit its component writes. SQL migrations remain authoritative, and no migration is applied during a request.

Generated worker-configuration.d.ts here contains only the pinned runtime types. Each app separately generates its own environment bindings. This lets the backend typecheck without importing either app's entrypoint. Regenerate all three files from the root with pnpm run types:bindings.

Use root pnpm commands. The app and jobs configurations reference this workspace's single migrations directory. No published package, network service, generic table repositories or new database was introduced.

See the [service-boundary review](../Root-of-Cambodia-Service-Boundaries.md) and [workspace review](../Root-of-Cambodia-Workspace-Review.md).

The [step 5 contract](../Root-of-Cambodia-Diagnostics-Delivery-Review.md) documents stable public errors, diagnostic-only guard categories, correlation privacy, and provider acceptance versus inbox delivery. Logging is best-effort and cannot alter operation results.

The first step 6 slice adds `property-drafts.ts` (normalization/access), `property-queries.ts` (private scoped reads) and `property-persistence.ts` (named atomic draft saves). Migration 0005 adds attributable append-only draft events. Existing booking/inventory modules, operations.ts and migrations 0001-0004 remain unchanged. See the [owner-draft review](../Root-of-Cambodia-Owner-Drafts-Review.md).

The next step 6 slice adds room-types.ts (bounded normalization/access), room-queries.ts (owner and exact-property reads) and room-persistence.ts (complete atomic room saves). Migration 0006 adds immutable attributable room events. Existing room revision/operation primitives are reused; booking and inventory operations, migrations 0001-0005, dependencies and lockfile remain unchanged. See the [room-type review](../Root-of-Cambodia-Room-Types-Review.md).

The pricing/availability slice adds calendar.ts (validation/access), calendar-dates.ts (local date-label arithmetic), calendar-queries.ts (owned seven-night projections) and calendar-persistence.ts (one versioned batch for selected stock/rate dates). Migration 0007 records immutable per-night calendar events. The new save preserves reserved counters, supports explicitly absent rows and reuses existing revision/receipt primitives. Existing booking/quote/inventory operations, migrations 0001-0006 and dependencies remain unchanged. See the [pricing/availability review](../Root-of-Cambodia-Pricing-Availability-Review.md).

Property information uses property-information.ts (normalization/access), property-information-queries.ts (owned optional-row projections) and property-information-persistence.ts (one atomic information/event/receipt save). Migration 0008 stores an independent versioned listing extension without changing booking-setting revisions. Facilities are ordered free text, not a verified taxonomy or machine policy. Existing operations/migrations and dependencies remain unchanged. See the [information review](../Root-of-Cambodia-Property-Information-Review.md).
