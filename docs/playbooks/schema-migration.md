# Schema migration playbook

**Status:** active task procedure; does not grant authorization.

**Responsible role:** maintainer (responsibility, not an assigned person).

**Last source verification:** 31 October 2026, main [40f7ffa](https://github.com/kimsourly1912/root-of-cambodia/commit/40f7ffa553a14005f622aa5c846f0f9dc5e70f42).

**Sources:** [database contract](../architecture/database.md), [migrations](../../packages/backend/migrations/), [listing-corrections.test.ts](../../packages/backend/src/features/listing-controls/tests/listing-corrections.test.ts), [migrations.test.ts](../../packages/backend/tests/migrations.test.ts).

## Use when

A [feature slice](feature-slice.md) needs a new table, column, index, trigger or guard. Schema changes need the task's authorization for code changes; remote migrations always need separate explicit approval and are not covered here.

## Steps

1. Never edit an applied migration. Add the next file: `packages/backend/migrations/00NN_<snake_case_purpose>.sql` (check the directory for the current highest number).
2. Keep it additive: new tables, columns with safe defaults, indexes and triggers. Existing rows, receipts, snapshots and history must survive unchanged. Do not backfill invented history; old rows get an honest "unavailable" or empty state.
3. Put invariants in the database where the [database contract](../architecture/database.md) expects them (triggers or guards that recheck actor, state and revision at write time).
4. Add the populated-upgrade test in the feature's test file, following the existing pattern:
   ~~~ts
   await migrate(db, env.TEST_MIGRATIONS.filter(m => m.name < "00NN").map(m => m.name));
   // insert representative rows, receipts and history with the old schema
   // then apply 00NN and assert everything is preserved and the new guard works
   ~~~
5. Older upgrade tests that compare whole schemas must stay scoped to their own migration (filter `m.name < "<their next number>"`), so a new empty table does not break them.
6. Fresh install is covered by [migrations.test.ts](../../packages/backend/tests/migrations.test.ts); run it.
7. Add the migration to the migration list in the [database contract](../architecture/database.md) and update the migration range in [status](../status.md).

## Checks

~~~sh
pnpm init:local                     # applies the new migration to local state; only if authorized
pnpm exec vitest run --project backend packages/backend/tests/migrations.test.ts packages/backend/src/features/<feature>/tests
pnpm test                           # after both builds
~~~

## Done when

- Fresh and populated upgrades both pass.
- No earlier migration file has a diff (`git diff --stat origin/main -- packages/backend/migrations` shows only the new file).
- The database contract lists the new migration.

## Pitfalls seen in this repository

- The 0018 index-upgrade test applied all future migrations, so it broke when 0019 added a table (#33). Scope each upgrade test to its own migration.
- Never delete a populated local database or `.dev.vars` to make initialization pass; reconcile instead (see [setup](../development/setup.md#existing-checkout-and-state-handoff)).
