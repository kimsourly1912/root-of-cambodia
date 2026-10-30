# Cloudflare staging setup

**Status:** resources provisioned; read-only application prepared; deployment pending.
**Responsible role:** maintainer for staging; project owner for account authorization.
**Last account/source verification:** 30 October 2026, based on main
[40f7ffa](https://github.com/kimsourly1912/root-of-cambodia/commit/40f7ffa553a14005f622aa5c846f0f9dc5e70f42)
and preparation source [2c9bb89](https://github.com/kimsourly1912/root-of-cambodia/commit/2c9bb896e1c4d3af66ccdb24d7edea0082c1cb49).
**Sources:** [web config](../../apps/web/wrangler.jsonc),
[jobs config](../../apps/jobs/wrangler.jsonc),
[runtime policy](../../apps/web/src/runtime-policy.ts),
[HTTP boundary](../../apps/web/src/http.ts), [status](../status.md).

## Instruction and temporary scope

The owner authorized Cloudflare-only staging setup, then activated R2 and
instructed: skip Email Sending for now; proceed with available services until
an account upgrade is announced. No third-party sender or paid upgrade is
introduced. The implementation choice for this instruction is an explicitly
read-only staging preview. It supports anonymous allowlisted browsing and
infrastructure checks. It does not establish a full booking pilot.

The deployed application must use `APP_MODE=staging-read-only` and exactly
`AUTH_URL=https://staging.rootsofcambodia.com`. Existing loopback local mode
retains its captured-mail development behavior. Unknown modes, remote local
capture and other staging origins fail closed. This is a distinct limited
mode, not disabling verification or disguising a remote runtime as local.

## Account and resources

| Item | Actual state |
| --- | --- |
| Account | `dcfd514b7e29898cd93e1bbb17b1aa22`, project account |
| Domain | `rootsofcambodia.com`, active; zone `ea10d4d2dd807cef27e6907d6ac1d4c5` |
| Staging origin | `https://staging.rootsofcambodia.com`; route/DNS not yet created |
| D1 | `roc-staging`, ID `169e1c39-c59a-40c8-8646-b82bbad08a2c`, APAC hint; no application migrations/data applied |
| R2 | Created `roc-media-staging` in APAC after successful activation; managed public domain disabled; no objects uploaded |
| Queue | `roc-notifications-staging`, ID `2fdbf2b65e5f4fd780a6deb1eb51c8d6`; retained without consumer or schedule |
| Web | `roc-web-staging`, prepared source/config; not deployed |
| Jobs | `roc-jobs-staging`, prepared inert config; no deployed consumer/Cron |
| Email | Explicitly deferred by owner; no send binding, live sender, capture table or substitute delivery in staging |
| Images | Staging binding omitted because uploads/processing are disabled; no entitlement upgrade needed for this slice |
| CLI | Pinned Wrangler installed; authenticated CLI session not established |
| Access | Account API reports Access not enabled; no organization/policies purchased or created |

Existing apex DNS and unrelated Worker remain unchanged. Resource IDs are
reused on continuation. Do not create another database or queue to work around
authentication.

## Read-only enforcement and limits

- Every business mutation through the shared HTTP boundary and photo-upload
  adapter returns `503 staging_read_only` before authentication, body parsing,
  business services or persistence. Private reads remain unauthenticated.
- Auth endpoints refuse all activity, including GET verification links, before
  Better Auth runs. Only exact `GET /api/auth/get-session` returns `null`, without
  reading or refreshing a session. Server-rendered private routes redirect to
  the unavailable-account screen without consulting a session.
- Sign-in, signup, verification, reset and recovery screens show an honest
  unavailable notice with no credential form. No account is marked verified,
  no token is exposed and no email is reported sent. The mail callback also
  refuses in staging as defense in depth.
- Public catalog projections and processed-only private-R2 photo reads retain
  their existing eligibility/privacy checks. No actual property is seeded and
  no original object is publicly exposed.
- Staging pages have noindex/nofollow metadata. This is an indexing instruction,
  not authentication. Public routes remain disabled in the committed config
  until a matching deployment and its permitted access scope are verified.
- Jobs retains its local-only runtime guard. No staged outbox is consumed,
  acknowledged or marked accepted, and no Cron is configured. No recurring
  expiry, cleanup, provider/recovery or inbox-delivery result is claimed.

The [staging built-Worker regression](../../tests/staging-runtime.test.ts) uses
isolated local bindings, applies the real schema there and verifies empty
catalog reads, unavailable auth UI/API, write/upload refusal, private access,
unchanged account/business/outbox counts and absent capture tables. It does
not mutate remote staging or prove live-service behavior.

## Remote migration approval and deployment

On 30 October automatic approval review rejected the first attempt to create
`d1_migrations` in remote `roc-staging`. It stated that persistent remote schema
changes require explicit authorization and contrasted them with the read-only
preview. The preview restriction concerns visitor actions; provisioning its
schema is a separate operator write. No rejected mutation was retried through
a different API, CLI or indirect path. The remote database remains without
application tables.

Before that operator step, obtain explicit approval to apply the existing
ordered migrations **0001–0020** to this isolated staging database, including
the standard migration-tracking table. No new SQL migration is introduced;
no production database, business seed, verification state, terms, data deletion
or reset is included. The release source already has historical fresh/populated
upgrade evidence; rerun appropriate local regressions for this runtime change.

After authorization and a supported secure CLI sign-in, the prepared operator
command from the repository root is:

```sh
corepack pnpm --filter @root-of-cambodia/web exec wrangler d1 migrations apply DB --env staging --remote
```

This command has not been executed. The explicit staging environment fixes the
account/database IDs above and uses the existing authoritative migration path.
The intended continuation is:

1. Recheck the account, exact staging database and migration history. Apply
   committed migrations with pinned Wrangler, retaining its atomic file and
   migration-history behavior. Do not run local capture-table initialization
   remotely or wrap the real database in test fixtures.
2. Generate a separate staging `BETTER_AUTH_SECRET` securely. Never reuse a
   local secret, print it or commit it. Build and dry-run the final source and
   explicit staging environment before deployment.
3. Deploy the web Worker with no Email/Images dependency. Keep jobs inert.
   Record source SHA, artifact/deployment IDs and resources before attaching
   the staging hostname; do not change the apex or workers.dev exposure.
4. Limit any initial anonymous deployment to this empty read-only preview.
   Confirm account APIs/private routes/writes remain unavailable. A future
   authenticated or data-bearing staging pilot needs controlled audience
   access, real email and the existing release/privacy/operations gates.
5. Check real HTTPS pages/assets, D1 catalog, auth/write/cache/robots behavior
   and private R2 configuration. Record actual results in status/PR. A build or
   isolated emulator pass is not live deployment evidence.

## Later email and pilot work

Wait for the owner to announce the Cloudflare upgrade. Then verify Email Sending
access/entitlement and sender-domain authentication before implementing sending.
Do not restore write access merely by changing a flag. Implement and verify
actual auth-mail and outbox adapters, provider timeouts/deduplication and lost
acknowledgements, controlled audience access, ordered release and recovery.
A custom message header is not proof of provider idempotency.

[Release/recovery gates](release-and-recovery.md#release-gates) for approved
terms, retention, abuse limits, support ownership, restore and Khmer/mobile
usability still apply before real pilot data. No legal approval, new retention
policy, subscription purchase or full pilot-readiness claim follows here.
