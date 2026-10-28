# Root of Cambodia — Foundation Compatibility Check

Completed: 28 October 2026

Outcome: The core Next.js/OpenNext + Better Auth + D1 combination passed local runtime checks. This is a narrow feasibility result, not a deployed application, load benchmark, full migration, or production-readiness certification.

## What was actually executed

| Check | Result | Evidence scope |
| --- | --- | --- |
| TypeScript check | Passed | Next.js routes, service helpers, generated binding types, and test code |
| Next.js production build | Passed | Upstream Next.js 16.4.3, webpack build |
| OpenNext Worker bundle | Passed | Adapter 1.20.13 produced the Worker |
| D1/Drizzle reservation tests | 7 passed | Cloudflare local D1 runtime via Wrangler platform proxy |
| Better Auth native D1 flow | 1 passed | Real auth library + local D1, in-process request handler |
| Built Worker request checks | 9 passed | Actual OpenNext bundle under local workerd through Wrangler's test harness |
| Interactive Wrangler preview CLI | Environment-blocked | Network-interface enumeration failed; programmatic harness worked |
| Remote Cloudflare deployment | Not run | No live resources provisioned |
| Real verification/reset email delivery | Not run | URLs captured in an isolated local test inbox; no messages sent |
| R2/media processing, Queues/Cron delivery, maps, recovery | Not exercised | These need dedicated tests and configured services |

## Tested versions

| Component | Version |
| --- | --- |
| Node | 24.22.1 |
| npm, used for the isolated fixture | 11.9.0 |
| Next.js | 16.4.3 |
| React / React DOM | 19.3.1 |
| OpenNext Cloudflare | 1.20.13 |
| Better Auth | 1.7.14 |
| Drizzle | 0.45.4 |
| Wrangler | 4.154.0 |
| TypeScript | 7.0.2 |
| tsx | 4.23.15 |

The lockfile captures transitive dependencies, including the Miniflare runtime bundled with this Wrangler release. These top-level versions satisfy the retrieved adapter peer requirements. This is a tested tuple, not a claim that arbitrary future versions work together.

## Seven D1/Drizzle tests

1. Drizzle observes the committed reservation written through native D1.
2. Concurrent last-room acceptance confirms exactly one request.
3. A capacity conflict rolls back earlier batch statements and all booking side effects.
4. A missing occupied night produces no partial reservation.
5. Repeated acceptance/cancellation allocates and releases only once.
6. Expired requests, wrong owners, and unverified actors do not write inventory.
7. Cancelling a Pending request does not add inventory.

The prototype uses a conditional status transition and database triggers for allocation, history, and outbox writes. A failed constraint/guard aborts the operation. It does not use PostgreSQL locks or an interactive JavaScript transaction.

A bug caught during the proof: D1 changes metadata includes trigger side effects. A successful single-booking cancellation can report more than one changed row, so an equality-to-one success check was incorrect. The fixture now uses a positive-change check.

## Authentication proof

The real Better Auth native D1 integration performed signup, rejected unverified login, generated a verification URL, verified it, created a cookie session, generated a reset URL, and changed the password. The old password was then rejected.

The local email transport writes only to a test table. It does not test Resend, DNS, inbox placement, bounces, or production delivery.

An initial missing-schema diagnostic is expected while the fixture starts from an empty database and runs auth migrations. Production migrations must run before serving traffic; the diagnostic is not being accepted as a valid deployed state.

## Nine built-Worker checks

1. Next.js SSR returns the expected HTML and Khmer text.
2. Anonymous session responses are private/no-store.
3. Email/password signup, verification, and cookie login work under workerd.
4. The verified cookie session reaches a Next.js server route.
5. Unauthenticated and cross-origin booking mutations are rejected.
6. Competing API requests produce one confirmation and one inventory conflict.
7. Another account cannot impersonate the property owner through a payload.
8. Password reset changes credentials under workerd.
9. Repeated failed authentication returns a rate-limit response.

Client-IP handling is explicit for the Cloudflare ingress header. The harness simulates separate clients and checks that rate limiting remains enabled.

## Environment and tooling findings

The interactive preview CLI failed with uv_interface_addresses while enumerating network interfaces in this execution environment. The safer alternative was Wrangler's programmatic test harness. It executed the built Worker and its bindings locally without changing the application framework or requesting elevated access.

A pnpm 11.25.0 lockfile import attempt failed with an internal minimumReleaseAge resolution-policy callback error. The isolated proof therefore uses npm and its lockfile. This does not settle the future application package-manager policy. No security policy was disabled to make the import pass.

The install emitted a transitive build-tool deprecation warning. A dependency security review and a fresh CI reproduction remain application-foundation work; this report is a compatibility check, not a complete security audit.

## Decision and practical limits

Proceed with Next.js, shadcn/ui, verified email, Better Auth, and D1 as the first-version direction. The local proof gives concrete evidence for the central integration and reservation invariants.

Do not treat the fixture as a finished booking engine. It has synthetic data, a deliberately small status model, limited quote fields, and a local-only email adapter. Full production constraints still need continuous stay-date coverage, capacity/occupancy validation, request idempotency, external booking handling, complete authorization, lifecycle transitions, and failure/recovery tests.

No production state or account settings changed. No real guest records, provider secrets, email tokens, runtime database state, or build output are included in the source archive.

## Next deliverable

Use Root-of-Cambodia-Build-Specification.md to finish the real D1 migrations, permissions, and API operations, then design the guest and owner screens around those contracts. Before a pilot, run the same core tests in staging and add live email, media/jobs, and restore checks.

## Reference points

- Product decisions: Root-of-Cambodia-Product-Plan.md
- Revised architecture: Root-of-Cambodia-Technical-Plan.md
- Reproducible source: [the reproducible foundation source](../proofs/foundation/)
- Official local D1 support: https://developers.cloudflare.com/d1/best-practices/local-development/
- Adapter versions/runtime guidance: https://opennext.js.org/cloudflare
- Better Auth email configuration: https://better-auth.com/docs/authentication/email-password
- D1 batch contract: https://developers.cloudflare.com/d1/worker-api/d1-database/

Counts and pass/fail results above describe commands executed in this session. They do not represent remote tests.
