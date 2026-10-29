# Root of Cambodia

A planned place-discovery and accommodation-booking platform for Cambodian users, covering selected listings across Cambodia.

Guests request stays and pay at the property. Owners manage their own property information, rooms, availability, and booking responses. Super admin operates the platform and handles review and support.

## Current status

The active application uses [apps/web](apps/web/README.md), [apps/jobs](apps/jobs/README.md) and [packages/backend](packages/backend/README.md), with reviewed migrations, verified sessions, atomic booking/inventory operations and notification recovery contracts. The owner interface supports verified access, private property drafts and private room-type setup. The broader product journeys and live infrastructure remain unfinished. See the [backend review report](docs/Root-of-Cambodia-Backend-Foundation-Review.md) for tests, scope and remaining decisions.

Current local validation: **93 Vitest tests** — 88 D1/runtime cases, three workspace checks and two built-Worker journeys — plus **six Playwright browser checks**. All prior 84 Vitest tests are retained. The [room-type review](docs/Root-of-Cambodia-Room-Types-Review.md) records the boundaries, fresh verification and browser-version limits. All 12 original website HTTP checks remain, with added request/log correlation and privacy checks. Delivery results now distinguish provider acceptance from inbox delivery and detect superseded leases. Separate typechecks and both builds passed. See the [step 5 review](docs/Root-of-Cambodia-Diagnostics-Delivery-Review.md). These are synthetic local results, not production verification.

Run active application commands from the repository root with Node 24.22.1 and **pnpm 12.15.0** (the packageManager pin):

```sh
pnpm install --frozen-lockfile
pnpm run init:local
pnpm run types:bindings
pnpm run typecheck
pnpm run build:worker
pnpm run build:jobs
pnpm test
```

The owner requested pnpm after step 5. [The migration review](docs/Root-of-Cambodia-Pnpm-Workspace-Review.md) records the workspace setup, exact dependency preservation and fresh pnpm evidence. The earlier npm choice is superseded for the active application; the historical proof below stays independent.

The following table records the earlier isolated proof; it remains historical evidence:

| Check | Observed result |
| --- | --- |
| TypeScript and Next.js production build | Passed |
| OpenNext Cloudflare Worker bundle | Passed |
| D1/Drizzle reservation tests | 18 passed after schema review |
| Better Auth native D1 flow | Passed with local email capture |
| Built Worker request checks | 9 passed under local workerd |

The proof covers last-room contention, rollback, repeated actions, verified sessions, owner isolation, password reset, and authentication throttling. Live email, remote deployment, media/jobs, maps, performance, and recovery remain unverified.

Overall architecture is approved: one modular Next.js application, one background Worker, shared business rules and one initial D1 database per environment. The [architecture record](docs/Root-of-Cambodia-Architecture.md) separates approved direction, current implementation and open decisions.

## Planning documents

- [Product plan](docs/Root-of-Cambodia-Product-Plan.md)
- [Approved architecture and next decisions](docs/Root-of-Cambodia-Architecture.md)
- [Approved booking/database design](docs/Root-of-Cambodia-Booking-Database-Design.md)
- [Architecture implementation plan](docs/Root-of-Cambodia-Implementation-Plan.md)
- [Approved step 4 workspace plan](docs/Root-of-Cambodia-Workspace-Plan.md)
- [Private room-type setup](docs/Root-of-Cambodia-Room-Types-Review.md)
- [Owner access and private property drafts](docs/Root-of-Cambodia-Owner-Drafts-Review.md)
- [pnpm workspace and verification](docs/Root-of-Cambodia-Pnpm-Workspace-Review.md)
- [Diagnostics and delivery contracts](docs/Root-of-Cambodia-Diagnostics-Delivery-Review.md)
- [Workspace/jobs verification](docs/Root-of-Cambodia-Workspace-Review.md)
- [Service and persistence boundaries](docs/Root-of-Cambodia-Service-Boundaries.md)
- [Database safeguards and upgrade verification](docs/Root-of-Cambodia-Database-Safeguards.md)
- [Completed Vitest alignment and verification](docs/Root-of-Cambodia-Vitest-Alignment.md)
- [Technical plan](docs/Root-of-Cambodia-Technical-Plan.md)
- [Initial build specification](docs/Root-of-Cambodia-Build-Specification.md)
- [Foundation check and evidence limits](docs/Root-of-Cambodia-Foundation-Check.md)
- [Schema and booking-rule review](docs/Root-of-Cambodia-Schema-Review.md)
- [Claude screen mockup brief and copy-ready prompts](docs/Claude-Mockup-Brief.md)

## Selected direction

- Next.js full stack, React, and TypeScript.
- shadcn/ui and Tailwind CSS for the planned interface.
- Better Auth with email verification; no phone verification.
- Cloudflare Workers with an explicitly tested OpenNext adapter.
- Cloudflare D1 with Drizzle; atomic reservation operations use D1-specific SQL.
- R2/Images and Queues/Cron are planned integrations.

## Run the isolated proof

The [foundation fixture](proofs/foundation/README.md) is a disposable technical check, not the application or a production starter. It requires no provider account or live credentials. Use Node 24.22.1 and npm 11.9.0 for the recorded version tuple.

```sh
cd proofs/foundation
npm ci
npm run init:local
npm run types:bindings
npm run typecheck
npm run test:d1
npm run test:auth
npm run build:worker
npm run test:worker
```

The fixture captures email locally and uses synthetic data. Local secrets, runtime databases, installed dependencies, and generated build output are excluded from Git. Do not deploy the local capture adapter.

## Next work

The application architecture and detailed booking/database direction are approved. Implementation-plan steps 1–5 are complete locally; PR #8 is merged. Step 6 is in progress: verified owner access/property drafts are merged, and private room-type setup is the next separate reviewable slice. Prices/calendar, media, review/publication and guest/owner booking screens remain. PR #10 and PR #11 were merged into main on 29 October with explicit authorization. Resolve arrival/occupancy/support policies and implement complete product flows before staging and pilot verification. Use the Claude brief for a Phase 1 guest prototype; the technical plan provides implementation constraints but does not specify enough screen behavior by itself. Complete staging and configured-service checks before a pilot. Operational decisions still open are listed in the build specification.
