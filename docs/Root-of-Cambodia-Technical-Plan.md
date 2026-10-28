# Root of Cambodia — Revised Technical Stack and Infrastructure Plan

Implementation update (28 October 2026): the [backend foundation review](Root-of-Cambodia-Backend-Foundation-Review.md) records the new application migrations/services, 24 D1 tests, 12 built-Worker checks, and unresolved release gates. Earlier proof results below are historical; no production verification or deployment is implied.

Updated: 28 October 2026

Status: Overall application architecture approved; see the [architecture decision](Root-of-Cambodia-Architecture.md). A backend foundation now exists in application/ and has local validation evidence. Full product flows and remote infrastructure remain incomplete. The [detailed booking/database proposal](Root-of-Cambodia-Booking-Database-Design.md) is prepared but awaits owner approval.

Companion: Root-of-Cambodia-Product-Plan.md

## 1. Decision summary

| Area | Revised direction | Status |
| --- | --- | --- |
| Application | Next.js full stack, React, TypeScript, App Router | User selected |
| UI | shadcn/ui with Tailwind CSS | User selected |
| Verification | Email verification; no phone verification | User selected; product plan updated |
| Database | Cloudflare D1, using SQLite and Drizzle's D1 driver | Approved initial database; detailed persistence review and staging remain pending |
| Hosting | Cloudflare Workers; upstream Next.js via OpenNext as the proposed deployment path | Next.js 16.4.3 + OpenNext 1.20.13 tested locally; remote deployment remains pending |
| Authentication | Better Auth, email/password with verification link | Selected; local foundation tested, live email remains unconfigured |
| Email delivery | Resend candidate behind a provider interface | Provider/domain not yet configured |
| Files and images | R2 plus an explicit Cloudflare Images integration | Retained |
| Jobs | Queues and a small Cron-driven jobs Worker | Retained |
| Maps | Google Maps candidate | Coverage, quota, and budget checks remain |
| Quality | TypeScript, ESLint, Vitest, React Testing Library where useful, Playwright | Approved direction; current Node-runner tests still need Vitest alignment |

Neon, Hyperdrive, PostgreSQL row-locking logic, Nuxt/Vue/Nuxt UI, Nuxt ESLint, phone OTP, and Twilio are removed from the proposed first-version stack.

D1 can support this booking model, but its transaction design must be written for D1 rather than copied from PostgreSQL.

## 2. Next.js on Cloudflare: an explicit hosting decision

shadcn/ui has an official Next.js setup. Next.js can provide public server-rendered pages, private dashboards, React Server Components, Route Handlers, and Server Actions in one codebase. Sources 1–3.

Running upstream Next.js on Workers requires an adaptation layer. OpenNext transforms the upstream Next.js build for Cloudflare and exposes Cloudflare bindings such as D1 and R2. Its documentation lists Next.js 16 support. Use an adapter-supported, security-patched stable release and pin the exact dependency set after testing.

There is an important current documentation change:

- Cloudflare now recommends vinext for new Next.js applications on Workers.
- vinext is a separate Vite-based implementation of the Next.js API surface.
- OpenNext continues to document the upstream Next.js build adaptation route.
- The retrieved Cloudflare guide labels vinext beta; maturity labels elsewhere differ. Verify the actual chosen release rather than assuming every Next.js feature is interchangeable.

Recommendation for this project: preserve the user's request for upstream Next.js and evaluate an explicitly configured OpenNext deployment first. Do not silently replace the framework implementation with vinext or rely on scaffolding that selects it automatically. If the required feature set fails that validation, revisit the hosting/adapter decision before feature implementation.

Use the Next.js runtime required by the chosen adapter. OpenNext currently instructs applications to use Next.js's Node.js runtime with Workers compatibility settings, not an arbitrary switch to Next.js Edge runtime.

The deployment check must exercise SSR, an authenticated mutation, cookies, email delivery, D1, images, redirects, and private-response caching. A successful local Next.js development server is not sufficient proof.

Sources 1–5 cover these distinctions.

## 3. D1 suitability and limits

D1 is an appropriate starting option for a lean, indexed pilot when we prove the booking invariants.

| Benefit | Consequence |
| --- | --- |
| Direct Cloudflare binding | No external SQL connection pool or Hyperdrive required |
| Usage-based rows/storage billing | Removes Neon's separate active database compute charges |
| SQLite and Drizzle support | Typed schema and queries remain available |
| Transactional batch API | Multiple SQL statements can commit together or roll back on an error |
| Built-in Time Travel | Useful recovery capability with a plan-dependent history window |

Important limits:

- D1 does not support the PostgreSQL-style interactive transaction callback and SELECT FOR UPDATE design from the previous plan.
- A conditional update affecting zero rows is not automatically an error; later unguarded statements can still run.
- A single database processes queries serially, so query duration and workload mix determine throughput.
- The current Workers Paid maximum is 10 GB per database. The included billing allowance is a different number.
- Current limits include 100 bound parameters per query and a 50-byte LIKE/GLOB pattern limit.
- Khmer characters use multiple UTF-8 bytes, making the search-pattern limit relevant to this product.
- No claim about unlimited concurrent guests or national-scale throughput is established by choosing Workers.

Use one database initially with indexed property, booking, inventory-night, deadline, ownership, and outbox queries. Do not introduce per-property databases or read replication before a measured need. All writes belonging to one booking operation must remain in the same database.

For Khmer/English search, start with province/category filters and normalized names. Select and test a strategy for longer search strings that does not pass an oversized LIKE pattern; assess indexed prefix/range or appropriate full-text/tokenization approaches with real Khmer data. PostgreSQL trigram assumptions do not carry over to SQLite.

Sources 6–9 describe the database behavior and limits.

## 4. Booking correctness on D1

The booking rules remain: owner response within 12 hours, requests at least 24 hours before check-in, no inventory hold for Pending requests, free guest cancellation before check-in, and payment at the property.

### Proposed database operation

Use an atomic SQL transition entrypoint with database-enforced invariants. A narrowly scoped SQLite trigger design is a candidate:

1. The server authenticates the caller, verifies email where required, and scopes the operation to the correct owner/property.
2. A conditional transition targets only the correct Pending request while its deadline is still valid.
3. Database validation requires every requested room/night to belong to the property, exist, have valid quantity, and have sufficient capacity.
4. The transition and its trigger-managed side effects reserve inventory for every occupied night, create allocation records, confirm the booking, and write its audit/outbox records.
5. A missing night, capacity conflict, inconsistent allocation, or other invariant violation raises a database error.
6. D1 executes the complete operation in a transactional statement/batch. A failed statement must roll back the entire batch.

The application foundation now implements and locally tests a version of this approach; see the backend review. The detailed trigger/transaction design still needs architecture review and remote verification before extension or production adoption. SQLite documents triggers and RAISE(ABORT); a local test does not establish production behavior.

All confirmation side effects must be linked to an actual permitted transition. A zero-row transition must not be followed by inventory/outbox writes that can run independently. Never use an application read followed by unrelated auto-committed writes as the reservation guarantee.

Use explicit parameterized SQL for this critical path where needed; Drizzle can manage ordinary queries and schema without hiding the invariants. Keep triggers small, documented, versioned in migrations, and included in integration tests.

### Repeated actions and races

- A repeated acceptance of an already Confirmed request does not allocate again.
- Use stable operation/event IDs and uniqueness constraints to handle retries.
- Cancellation releases only committed allocations, once, with its own atomic transition.
- Expiry and decline do not increase stock because Pending requests did not reserve it.
- Online acceptance, external bookings, maintenance blocks, and capacity reductions use the same inventory rules.
- Capacity constraints reject negative or oversold inventory.
- Validate the authoritative deadline inside the atomic operation, including after request/network delays.
- Resolve acceptance/cancellation/expiry races from current database state, not client state.
- Never send email inside the database operation.

Single-database serialization is useful but does not make an unsafe multi-call workflow atomic. Source 10 covers SQLite error behavior; sources 6–7 cover D1 batching.

### Data conventions

Use integer USD cents for money; explicit UTC timestamps for events/deadlines; and local calendar dates for occupied nights. Interpret property check-in/check-out using Asia/Phnom_Penh. Check-out does not consume another night.

Preserve the submitted room, dates, occupancy, prices, charges, currency, and policy. Missing inventory means unavailable.

Nightly quantities alone do not prove one physical room is available continuously when individual units have different maintenance blocks. Validate that operational detail with pilot owners.

## 5. Email authentication and account access

Proposed first-version flow:

1. Guest or owner registers with a name, email address, and password.
2. The app sends a verification link.
3. The user verifies access to that inbox.
4. The server requires verified email for booking submission and owner publication/booking operations.
5. The account uses secure persistent sessions; verification is not repeated on every page visit.
6. Password reset and sensitive email changes follow the authentication library's supported flows.

Better Auth documents email/password, verification email hooks, and Next.js integration. It also documents native D1 support. Prefer evaluating its native D1 integration for auth; use Drizzle for business tables. This avoids assuming that a generic interactive-transaction adapter works on D1. A Drizzle SQLite auth adapter remains an alternative only after verifying its supported configuration.

Generate auth schema through the selected supported tool and incorporate reviewed SQL into one migration process. Do not run competing automatic migration systems on live requests. Check every selected auth plugin against D1; basic D1 support does not imply all optional plugins support D1.

Security requirements:

- Require server-side emailVerified checks, not a client-only banner.
- Use expiring verification/reset tokens and the library's supported validation/storage behavior.
- Throttle verification resends, login, registration, and password-reset requests.
- Avoid account enumeration in public responses.
- Changing an email address requires verification of the new address and appropriate reauthentication.
- Protect super admin with additional authentication, such as TOTP or passkeys after compatibility testing.
- Treat verified email as inbox control, not proof of legal identity or arrival intent.
- Phone verification is absent. Any optional phone contact field is informational, not an identity or recovery factor.

Sources 11–14 establish integration capabilities; these exact package versions and flows still need runtime validation.

## 6. Email provider and notifications

Recommend a provider interface with Resend as the initial candidate for verification, resets, and transactional booking email. Cloudflare documents sending through Resend from Workers.

Provider setup needs a real sending domain/subdomain, appropriate DNS authentication, bounce/complaint handling, allowed callback URLs, monitored quotas, and a controlled staging sender. Avoid leaking verification tokens or guest details into logs or tracking links.

Cloudflare Email Service is an alternative: its current docs describe arbitrary-recipient transactional sending on Workers Paid, but Email Sending is labeled beta. Ordinary Email Routing to preverified destinations is not a substitute for sending verification messages to arbitrary guests. Evaluate it separately if keeping email on Cloudflare is a priority.

Primary notifications: email plus in-app records. SMS and Cambodian mobile-network registration are removed from version-one dependencies.

Use the booking transaction to write an outbox event. After commit, publish its ID to Queues; a jobs Worker loads the event and records delivery attempts. A scheduled outbox pass recovers a failed publish. Deduplicate repeated queue messages and use provider idempotency when supported. Do not promise exactly-once inbox delivery.

Auth email has a separate latency requirement: enqueue/send it promptly and make delivery failure visible and retryable without leaving the user stuck. Never block the database transaction on a provider request.

Sources 15–18 cover provider and queue behavior.

## 7. Application structure and authorization

The [approved architecture](Root-of-Cambodia-Architecture.md) establishes a modular monolith: one web application and a small jobs Worker reuse business modules. Shared code is a library, not a third network service. Detailed persistence/module layout review precedes restructuring.

One repository contains:

- Next.js web application: guest, owner, and super-admin areas, route handlers, auth, and server-side business entrypoints.
- Small jobs Worker: cron, queue delivery, due-event processing, media cleanup.
- Shared schema/contracts and business operations usable by both entrypoints.

Recommended modules: identity/access, places, accommodation, rates/inventory, bookings, media, notifications, and platform operations.

Keep route handlers and Server Actions thin. Call shared services for rules and persistence. Do not duplicate booking behavior between action, API, and jobs paths. No separate Hono server is necessary for the agreed scope.

Every server entrypoint authorizes access independently. A protected layout or hidden button does not protect a Server Action. Scope every property/room/photo/booking query to its authorized owner or guest. Super-admin privileges must not be self-assignable.

D1 is accessed through server-side bindings. Do not expose Cloudflare API tokens or use the database administration HTTP API from the browser.

Candidate tables remain auth tables, owner profiles, places/properties, room types, nightly inventory/rates, bookings, booking room/night lines, allocations, events, outbox/delivery records, media assets, favorites, and reports.

Source 19 covers Next.js authorization boundaries; sources 4 and 9 describe bindings and the D1 driver.

## 8. Rendering, caching, and media

- Server-render public destinations/property information for useful initial HTML and search indexing.
- Use interactive client components where needed for maps, forms, calendars, and dashboards.
- Keep authenticated/booking responses out of shared Next.js, CDN, and KV caches.
- Choose explicit freshness behavior for availability and session/permission checks.
- If D1 read replication is later enabled, use an appropriate primary/session strategy for critical reads and read-after-write behavior; do not assume replicas are always current.
- Cache immutable processed photos using versioned keys.
- Add public-page caching only with deliberate publication/update invalidation.
- OpenNext's own incremental cache is a separate adapter resource; enable/configure it only for intended public content.

R2 stores private originals and processed assets. Authorize owner uploads, validate format/bytes/dimensions, remove unwanted metadata, publish controlled variants, and recover failed processing. Select an Images-backed Next.js image path rather than assuming Node-only image processing works on Workers.

R2 and Images billing remains separate from Workers/D1. Retain list-view/location-permission fallbacks and restricted map API keys. Google Maps is still a candidate rather than a configured service.

Sources 20–22 describe adapter caching, images, and D1 consistency.

## 9. Scheduling and recovery

Store request deadlines in D1. Process due expiry/reminder/outbox work in indexed bounded batches. Acceptance rejects expired requests even when cron is delayed.

A one-minute maintenance schedule can be evaluated without Neon's continuous-compute issue; it still generates D1 reads/writes and Worker work. Avoid scanning the entire booking table each minute. Make overlapping runs and retries safe.

Use D1 Time Travel and an independent retained export strategy. Current history windows are 30 days on Workers Paid and 7 days on Free. Document recovery targets and rehearse restoration without damaging live records. Code rollback does not reverse data changes.

Bound retained outbox, logs, and event growth so a central database does not approach its hard size ceiling unexpectedly.

Sources 8, 23, and 24 support these operational choices.

## 10. Environments, versions, and delivery

| Environment | Plan |
| --- | --- |
| Local | Local emulated D1 and adapter bindings; test email adapter |
| Staging | Separate D1, R2, queues, auth settings, sender/keys; synthetic data |
| Production | Dedicated live resources, domain, monitored quotas, recovery and access controls |

- Use one repository, a pinned package manager/lockfile, and a compatible maintained Node LTS for development and CI. This draft originally proposed pnpm; the implemented foundation uses npm. Standardizing the package manager is an explicit open tooling decision, not an approved silent migration.
- Pin Next.js, React, adapter, Better Auth, Drizzle, Tailwind, and component dependencies to a verified compatible set.
- Do not copy an @rc dependency from documentation without deliberately choosing a release candidate.
- shadcn/ui component source is maintained in our repository; updates require review.
- Use the current Next.js ESLint setup and ESLint CLI; remove Nuxt-specific lint tooling.
- Keep the Workers compatibility date/flags deliberate.
- Run lint, types, relevant tests, Next.js build, adapter build, and Workers preview checks.
- Test with workerd/Cloudflare-compatible preview; next dev runs in a different environment.
- Apply reviewed schema/trigger migrations through one controlled process before dependent code.
- Keep production deploy paths singular; version web and jobs code against compatible event/schema contracts.
- Keep bindings and provider secrets server-only and separate per environment.

Version sets are pinned in application/ and in the separate historical proof. The application foundation has local checks; deployed resources, domain/provider accounts and CI credentials remain unconfigured. See the backend review for current evidence and the local-proof section below for historical results.

## 11. Required proof before feature rollout

| Check | Evidence needed |
| --- | --- |
| Next.js hosting | Supported build runs on Workers with SSR, cookies, route handlers/actions, D1, and images |
| Email auth | Registration, verification, login, resend, reset, and email changes work in staging |
| D1 schema | Real D1 accepts migrations, constraints, triggers, and the chosen batch/driver paths |
| Last room | Simultaneous acceptance yields one confirmation and one conflict |
| Multi-night failure | One unavailable/missing night rolls back all allocations, status, audit, and outbox changes |
| Duplicate/reordered requests | Acceptance, cancellation, expiry, and external bookings cannot double-allocate or release twice |
| Isolation | Another owner/guest cannot read or mutate unrelated private records |
| Jobs/email | Delivery failure, duplicate queue messages, and missed publish recover without changing a booking twice |
| Search | Khmer/English queries, long multibyte input, filters, and pagination behave within D1 limits |
| Recovery | Export and restore drill meets the agreed recovery targets |

Use Vitest for business rules, real-D1 integration checks for atomicity, and a small Playwright set for complete guest/owner journeys. SQLite-only unit tests are useful but cannot prove D1 or adapter compatibility.

The initial documentation review was followed by the local foundation proof described below. Only the specifically recorded checks have been executed; the remaining rollout checks are still open.

## 12. Cost changes

The revision removes Neon's separate database compute/storage bill and all SMS verification fees. It does not make the entire application free or guarantee a $5 monthly total.

| Item | Planning basis |
| --- | --- |
| Workers Paid | Minimum $5/month, with usage-based overages |
| D1 Paid allowance | First 25 billion rows read/month, 50 million rows written/month, and 5 GB storage included |
| D1 overage | $0.001/million rows read, $1/million rows written, $0.75/GB-month beyond allowances |
| D1 database ceiling | 10 GB per database; distinct from the 5 GB included billing allowance |
| Resend candidate | Free tier currently 3,000 emails/month and 100/day; Pro currently $20/month for 50,000 emails |
| R2, Images, maps, queues | Separate limits and usage charges as applicable |
| Other | Domain, CI usage, monitoring, retained exports, and taxes |

Free email quotas may be exhausted by verification, resets, booking updates, and owner reminders together. Choose a paid tier or capacity strategy before daily limits can stop essential account email.

Forecast from actual listings, rooms, retained inventory nights, indexed query work, photos, map loads, email volume, and job frequency. No guaranteed capacity or total cost has been established.

Sources 7–8, 16, and 25 contain current limits/pricing; recheck before provisioning.

## 13. Next planning work

1. Specify D1 tables, indexes, constraints, booking operation SQL, and trigger responsibilities.
2. Define the permissions matrix and server operation contracts.
3. Finalize email/password screen flows, sender/provider, recovery behavior, and privacy rules.
4. Run the focused Next.js/adapter/D1/auth proof before building the full feature set.
5. Design guest and owner screens alongside the data/contracts.
6. Implement in product-plan order and run a controlled pilot.

No need to add PostgreSQL, Hyperdrive, Redis, a search cluster, Durable Objects for inventory, or separate guest/owner backends at this point. Revisit the database based on measured contention, growth, and operational needs; a future PostgreSQL migration would require explicit schema/data and booking-SQL migration work.

## 14. Local foundation proof — 28 October 2026

A separate local fixture has now provided the following evidence:

- TypeScript check, Next.js production build, and OpenNext Worker bundle passed.
- Seven D1/Drizzle reservation tests passed: last-room contention, multi-night rollback, missing inventory, repeated acceptance/cancellation, expiry, access/verification boundaries, and the Drizzle read path.
- Better Auth's native D1 signup/verification/session/password-reset flow passed using captured local email URLs.
- Nine built-Worker request checks passed under local workerd, including SSR, private sessions, verified login, origin/access protection, the booking race, owner isolation, reset, and authentication throttling.

Tested main versions: Node 24.22.1, Next.js 16.4.3, React 19.3.1, OpenNext 1.20.13, Better Auth 1.7.14, Drizzle 0.45.4, Wrangler 4.154.0, TypeScript 7.0.2.

The interactive preview CLI could not enumerate network interfaces in this sandbox; Wrangler's programmatic harness ran the actual built Worker successfully. The isolated fixture uses npm 11.9.0 because pnpm 11.25.0 lockfile import hit an internal tooling error. The future application package-manager decision is not settled by that workaround.

No real email was sent. No remote deployment, media optimization, queue/cron delivery, map, load, or restore test has been performed. The trigger schema is a tested prototype, not a complete production booking migration.

See Root-of-Cambodia-Foundation-Check.md for observed evidence, [the reproducible foundation source](../proofs/foundation/) for reproducible source, and Root-of-Cambodia-Build-Specification.md for the initial data model, permissions, state transitions, and API contract draft.

## Sources

Official sources checked for this revision on 28 October 2026:

1. shadcn/ui Next.js setup: https://ui.shadcn.com/docs/installation/next
2. Cloudflare Next.js guide and vinext recommendation: https://developers.cloudflare.com/workers/framework-guides/web-apps/nextjs/
3. Cloudflare OpenNext guide and feature support: https://developers.cloudflare.com/workers/framework-guides/web-apps/opennext/
4. OpenNext Cloudflare bindings: https://opennext.js.org/cloudflare/bindings
5. OpenNext versions/runtime: https://opennext.js.org/cloudflare
6. D1 database/batch API: https://developers.cloudflare.com/d1/worker-api/d1-database/
7. D1 pricing: https://developers.cloudflare.com/d1/platform/pricing/
8. D1 limits: https://developers.cloudflare.com/d1/platform/limits/
9. Drizzle D1: https://orm.drizzle.team/docs/connect-cloudflare-d1
10. SQLite triggers and RAISE: https://www.sqlite.org/lang_createtrigger.html
11. Better Auth Next.js: https://better-auth.com/docs/integrations/next
12. Better Auth email/password: https://better-auth.com/docs/authentication/email-password
13. Better Auth email verification: https://better-auth.com/docs/concepts/email
14. Better Auth native D1 support: https://better-auth.com/blog/1-5
15. Cloudflare Resend integration: https://developers.cloudflare.com/workers/tutorials/send-emails-with-resend/
16. Resend pricing: https://resend.com/pricing
17. Cloudflare Email Service: https://developers.cloudflare.com/email-service/
18. Queue delivery guarantees: https://developers.cloudflare.com/queues/reference/delivery-guarantees/
19. Next.js authorization guidance: https://nextjs.org/docs/app/guides/authentication
20. OpenNext cache guidance: https://opennext.js.org/cloudflare/caching
21. Cloudflare Images: https://developers.cloudflare.com/images/pricing/
22. D1 read replication: https://developers.cloudflare.com/d1/best-practices/read-replication/
23. Cron Triggers: https://developers.cloudflare.com/workers/configuration/cron-triggers/
24. D1 Time Travel: https://developers.cloudflare.com/d1/reference/time-travel/
25. Workers pricing: https://developers.cloudflare.com/workers/platform/pricing/

Some adapter/cache/media details are retained architectural recommendations; exact release behavior must be checked during the foundation proof. Documentation review establishes feasibility, not deployed correctness or a load benchmark.
