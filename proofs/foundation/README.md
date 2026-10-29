# Root of Cambodia — local foundation proof

> **Historical independent fixture.** Reproduction instructions below apply only inside proofs/foundation, not to the active app. Current application evidence is in [status](../../docs/status.md); the original README is [archived](../../docs/archive/2026-10/readmes/foundation-README.md).

**Responsible role:** fixture maintainer. **Last source verification:** 29 October 2026, 607a705. **Sources:** [fixture manifest](package.json), [original review](../../docs/archive/2026-10/Root-of-Cambodia-Schema-Review.md).

This is a disposable compatibility fixture, not the application or a production starter. It tests upstream Next.js/OpenNext, native Better Auth + D1, Drizzle's D1 read path, and a small atomic reservation design.

No deployment command is provided. All data is synthetic. Email is captured locally and never sent. Do not deploy the capture adapter or reuse its token table in production.

## Reproduce

Use Node 24.22.1 (or validate a compatible maintained release) and npm 11.9.0.

```sh
npm ci
npm run init:local
npm run types:bindings
npm run typecheck
npm run test:d1
npm run test:auth
npm run build:worker
npm run test:worker
```

The tests create isolated local data. The Worker test uses Wrangler's programmatic harness and exercises the actual built bundle with request/cookie semantics. It does not require a Cloudflare account or provider keys.

init:local generates a random local auth secret if missing and never prints its value. Keep it private. It is deliberately excluded from Git.

For an optional manual preview, prepare:local seeds the default local state, then preview:worker runs Wrangler's CLI. Preparation is for a fresh local state, not a migration runner for an existing application. This CLI failed to enumerate network interfaces in the original sandbox; test:worker succeeded through the harness.

## Layout

- app/: minimal SSR page, auth handler, private session route, and authenticated acceptance route.
- src/auth.ts: real Better Auth configuration, explicit Cloudflare client-IP header, local email-capture transport.
- src/booking.ts: guarded native D1 operations.
- schema/booking.sql: prototype constraints/triggers and synthetic-model tables.
- schema/auth-generated.sql: auth SQL generated during the local proof.
- tests/: D1 tests, auth flow, and built-Worker request checks.
- scripts/: local secret initialization and optional synthetic-state setup.
- worker-configuration.d.ts: generated locally by types:bindings; excluded from Git.
- ../../docs/: observed results, plans, and the initial build specification.
- package-lock.json: exact dependency resolution for this fixture.

The active application now uses the pinned root pnpm workspace; see [setup](../../docs/development/setup.md) and [ADR 0003](../../docs/architecture/decisions/0003-pnpm-workspace.md). This historical fixture remains independent with its original npm lockfile. The earlier pnpm-import failure describes only the proof environment; it is not an open active-tooling decision.

## Important boundaries

The schema only covers a narrow reservation prototype. The follow-up schema review adds immutable sealed quote rows, canonical dates and complete per-room-type stay coverage, integer quantities/prices, total validation, transition guards, and attributable owner cancellation reasons. Its 18 D1 tests include these safeguards. See [the review](../../docs/Root-of-Cambodia-Schema-Review.md) for results and remaining gaps.

Fixture construction writes a pending booking and nightly rows, then seals the snapshot in one D1 batch. Acceptance requires a sealed snapshot. `expected_nights` means the number of quoted room-type/night rows in this fixture; it is not the number of nights in a multi-room-type stay. Production should use explicit booking-line identities and derive stay duration from local dates.

This is a fresh-database proof schema, not an upgrade migration. Existing local proof databases must be recreated; do not apply it to an existing application. It is not the final model for full policy/occupancy snapshots, all statuses, external bookings, support, or retention. The cancellation command takes an explicit guest/owner context, checks ownership, and requires an owner reason; there is no cancellation HTTP endpoint in this fixture.

The production email provider, real delivery, remote deployment, shadcn component screens, R2/Images processing, Queues/Cron delivery, maps, performance, and backups have not been proven by this fixture.

The standalone auth test and Worker test initially bootstrap an empty database. Better Auth can report missing tables before the test migrations create them. That expected bootstrap diagnostic is not permission to serve an unmigrated production database.

The rate limiter remains enabled. The request harness supplies synthetic ingress IPs for separate simulated clients and verifies a 429 response for repeated failed sign-in.

Never use browser payloads as evidence of verification or ownership. The acceptance route obtains identity from the server session, checks origin, and scopes the database mutation to the property's owner.
