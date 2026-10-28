# Root of Cambodia

A planned place-discovery and accommodation-booking platform for Cambodian users, covering selected listings across Cambodia.

Guests request stays and pay at the property. Owners manage their own property information, rooms, availability, and booking responses. Super admin operates the platform and handles review and support.

## Current status

The application backend foundation is now in [application/](application/README.md), with reviewed migrations, verified sessions, atomic booking/inventory operations and notification recovery contracts. The product interface and live infrastructure are not built or deployed. See the [backend review report](docs/Root-of-Cambodia-Backend-Foundation-Review.md) for tests, scope and remaining decisions.

Current application validation: **24 D1 tests**, **12 built-Worker HTTP checks**, TypeScript, Next.js and OpenNext builds passed locally. These are not production verification.

The following table records the earlier isolated proof; it remains historical evidence:

| Check | Observed result |
| --- | --- |
| TypeScript and Next.js production build | Passed |
| OpenNext Cloudflare Worker bundle | Passed |
| D1/Drizzle reservation tests | 18 passed after schema review |
| Better Auth native D1 flow | Passed with local email capture |
| Built Worker request checks | 9 passed under local workerd |

The proof covers last-room contention, rollback, repeated actions, verified sessions, owner isolation, password reset, and authentication throttling. Live email, remote deployment, media/jobs, maps, performance, and recovery remain unverified.

## Planning documents

- [Product plan](docs/Root-of-Cambodia-Product-Plan.md)
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

Review the dependent backend-foundation PR and its release gates, agree arrival/occupancy/support policies, wire the selected email/jobs services, and design the guest/owner screens in product-plan order. Use the Claude brief for a Phase 1 guest prototype; the technical plan provides implementation constraints but does not specify enough screen behavior by itself. Complete staging and configured-service checks before a pilot. Operational decisions still open are listed in the build specification.
