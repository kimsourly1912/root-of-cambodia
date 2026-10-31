# Cloudflare staging setup

**Status:** live interactive fixture testing verified; evidence in [status](../status.md).
**Responsible role:** maintainer for staging; project owner for account authorization.
**Verified source date:** 30 October 2026.

## Authorized scope

The owner authorized Cloudflare-only staging and remote migrations/deployment,
activated R2, deferred Email Sending until a later upgrade, and then requested
that implemented features be added to staging for testing. No paid upgrade,
third-party hosting/sender, real customer seed or production change is authorized
by this test setup.

Use APP_MODE=staging-test and exactly
AUTH_URL=https://staging.rootsofcambodia.com. Unknown modes, deceptive origins
and remote local capture fail closed. The existing staging-read-only mode remains
available as a conservative code/config fallback. A rollback does not undo data.

## Resources

| Item | Isolated staging state |
| --- | --- |
| Account | dcfd514b7e29898cd93e1bbb17b1aa22 |
| Domain | rootsofcambodia.com; zone ea10d4d2dd807cef27e6907d6ac1d4c5 |
| Origin | [Testing guide](https://staging.rootsofcambodia.com/testing); only this custom domain, no workers.dev/preview URL |
| D1 | roc-staging; 169e1c39-c59a-40c8-8646-b82bbad08a2c; existing migrations 0001–0020 tracked in d1_migrations |
| R2 | roc-media-staging, APAC; private originals/previews; managed public domain disabled |
| Web | roc-web-staging; DB, MEDIA, IMAGES and ASSETS, separate auth secret |
| Images | Native binding; free transformation allowance, no paid Images storage subscription |
| Queue | roc-notifications-staging; 2fdbf2b65e5f4fd780a6deb1eb51c8d6; no consumer |
| Jobs | roc-jobs-staging config only; not deployed, no Cron |
| Email | Deferred; no send binding, sender or remote capture tables |
| Access | No organization/application/policy created |

The Images free allowance is currently 5,000 unique transformations/month;
additional new transformations fail rather than incur free-plan overage charges.
See [Cloudflare pricing](https://developers.cloudflare.com/images/pricing/) and
[binding](https://developers.cloudflare.com/images/optimization/binding/).
Monitor usage before widening testing. This is not a paid-plan upgrade.
Existing apex DNS and unrelated Worker remain unchanged.

## Test accounts and data

Only staging-owner-v1, staging-guest-v1 and staging-reviewer-v1 are admitted by
private adapters/SSR. Each is an explicitly fictional .invalid identity, seeded
with a separately generated strong password hash. Credentials are supplied
privately outside git and never embedded in pages, logs or public endpoints.
Normal Better Auth sessions use HTTPS Secure/HttpOnly cookies. Backend verified
identity, ownership, publication, inventory and transition rules remain unchanged.
Synthetic fixture emailVerified=1 is test data, not evidence of any real inbox.

Exact sign-in/email, sign-out and GET get-session are the only admitted auth API
paths. Sign-in requires the exact Origin, bounded JSON and an allowlisted email.
Signup, verification links, recovery, profile changes and other account APIs fail
503 before auth runs. Staging mail callbacks refuse delivery as defense in depth;
local capture remains loopback-only. UI explains these limitations.

The trusted [operator](../../scripts/seed-staging.ts) bootstraps only the fixed
fixtures after checking existing identities/schema/configuration. It preserves
existing passwords and refuses mismatches. It then uses normal HTTPS app APIs to
create properties, calendar, R2/Images uploads, disclosure acknowledgements,
review decisions and booking requests. There is no public bootstrap endpoint.
See [fixture instructions](../../fixtures/staging/README.md). Keep private input
and seed-state.json outside git; reuse them for uncertain-outcome retries. Never
reset staging, replace IDs/passwords or overwrite tester edits to rerun setup.
The local service fixture exercises equivalent services in isolated tests.

Initial fixtures: two published stays (Kampot and Siem Reap), one submitted
Mondulkiri property, one editable empty Kep draft, 35 nights of room stock/prices,
one Pending and one Confirmed guest request. Original illustrations, contact data,
prices and immutable terms are explicitly fictional. No real reservation/payment
or legal terms are offered. All tester changes persist. Use separate browser
profiles or sign out between roles. The guide links the publication reviewer.

Noindex/nofollow is indexing metadata, not authentication. Public listing
projections and processed-only photo access retain normal eligibility checks.
Original R2 files and private owner/guest/reviewer media stay private/no-store.
Arrival/completion retain real schedule limits and payments remain external
bookkeeping. No clock bypass, money collection or fake delivery success exists.

## Deferred work

Jobs remains local-only and unscheduled. Notifications remain pending with no
accepted/delivered attempts. Recurring expiry, media cleanup and queue recovery
are not operating remotely; ordinary request checks still enforce deadlines.
Use this small test environment while inspecting those limits. After the owner
announces an upgrade, separately implement Cloudflare Email Sending, real
signup/verification/recovery, approved sender/terms/reviewer identity, deployed
maintenance and the remaining [release gates](release-and-recovery.md). No full
pilot/production readiness, restore/load or inbox-delivery claim follows here.

## Approval and deployment history

Automatic review initially rejected creating d1_migrations and widening Wrangler
scopes. The owner explicitly replied “yes sure, I approve all the ways to finish
our staging live preview” to those concrete staging-only steps. Migrations
0001–0020 and standard tracking were then applied atomically per file; foreign-key
and quick checks passed. No schema file has been changed by interactive testing.

The initial read-only deployment used runtime source
87052d21f01eec2c5550d7c839bac7c2c01106ed and passed 18 real HTTPS checks.
Initial secret-adjusted version was 9d04d48c-284a-4684-b217-19dd9a258eec,
deployment de27e66e-8a31-4e8b-86aa-d6c1cbde9b3f. These are historical read-only
results, not authenticated testing evidence.

During interactive preparation automatic review rejected creating an account-wide
Access organization/auth domain/session policy. That optional action was not
retried. Existing application login with private fictional credentials was chosen
instead. No account-wide security boundary or real inbox verification changed.

Pinned Wrangler builds/deploys with --env staging --no-autoconfig. Keep the
already provisioned resource IDs/custom domain and separate secret. Never deploy
local capture config to HTTPS. Record actual source SHA/version, smoke results
and CI in status/PR; deploy/build success alone is not live behavior evidence.

## Automatic web deployments from main

The owner approved merge-to-staging delivery on 31 October 2026 and subsequently
accepted parallel verification, documentation filtering, protected main and reuse
of equivalent successful PR verification with a full fallback. The authoritative
workflow, receipt rules, activation state and manual protection instructions are
in the [CI/CD contract](ci-cd.md) and [status](../status.md).

[verify.yml](../../.github/workflows/verify.yml) verifies PRs or explicit full
requests. [deploy-staging.yml](../../.github/workflows/deploy-staging.yml) handles
main delivery: docs-only pushes skip release; application pushes reuse exact-tree
successful PR proof or run full verification, then build staging from main,
check migration inventory, serialize upload and run exact-revision HTTPS smoke.
Only the deployment step receives the existing GitHub `staging` environment secret
`CLOUDFLARE_API_TOKEN`. Wrangler staging configuration selects the existing account.
The existing `BETTER_AUTH_SECRET` stays in Cloudflare; no value belongs in GitHub.

The owner configured the environment/token and the original automatic release
passed in [CI 41178698696](https://github.com/kimsourly1912/root-of-cambodia/actions/runs/41178698696),
main `237343d07d6ee611e3df573f933c9a1a95c7226f`. The optimized workflow requires its
own exact-head PR and post-merge evidence; the older release is not that proof.

This pipeline never applies remote migrations, resets/seeds D1, rotates fixture
passwords, deploys jobs, enables email or touches production. New migrations stop
release until separately reviewed and applied, followed by a manual current-main
redeploy. Filename matching is not a migration checksum or restore proof. A Worker
rollback does not reverse data. Failed live smoke requires investigation and does
not automatically roll back code/data. Existing tester edits and credentials persist.

For a manual current-main release use **Actions → Deploy staging → Run workflow →
main**. **Verify application → Run workflow** verifies only. The live smoke checks
readiness/revision, fixture/noindex pages, uncached anonymous reads and private API
refusal. It is anonymous/read-only, not three-account, real-device, email, restore
or full production-readiness evidence.
