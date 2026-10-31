# CI and staging delivery

**Status:** implemented on `feat/faster-ci`; PR verification and activation evidence belong in [status](../status.md). Branch protection requires the owner setup below.

**Responsible role:** repository owner for protection settings; maintainer for CI and staging delivery.

**Last source verification:** 31 October 2026; based on main [91cd803](https://github.com/kimsourly1912/root-of-cambodia/commit/91cd803cbe7be7e996a2b456cac8eb03953430eb).

**Sources:** [verification](../../.github/workflows/verify.yml), [staging workflow](../../.github/workflows/deploy-staging.yml), [setup action](../../.github/actions/setup/action.yml), [CI orchestration](../../scripts/ci.ts), [regressions](../../tests/tooling/ci.test.ts), [staging contract](staging.md).

## Accepted scope and ownership

After reviewing the measured 6m46s verification and 1m31s staging release, the
owner replied “ok go with your recommendation” on 31 October 2026. This accepts
parallel isolated testing, docs filtering, caches, artifact sharing, failure
reports, protected main and reuse of equivalent successful PR verification with
a full-CI fallback. It does not add a second reviewer, change product policy,
authorize production or migrations, or imply that the optimized workflow is live
before its PR is merged. D18 reviewer/emergency arrangements remain open.

## PR verification

`verify.yml` runs for PRs targeting main, manual requests and reusable calls from
staging delivery. Every job checks out the triggering immutable SHA. A change
classifier and documentation link check run first, using pinned Node without an
application install. Only `README.md` and Markdown under `docs/` take the docs
path; missing history, unknown changes, workflow/config/test/lockfile changes and
manual full verification take the application path.

For application changes, types/backend/tooling checks run alongside one web/jobs
build. The build publishes only a tar of generated test Worker bundles, preserving
hidden files and modes. Three separate jobs consume that same run's artifact:
Worker integration, desktop Chromium and phone Chromium. Each runner has isolated
D1/R2/fixture state. Keep Playwright workers=1 and existing sequential fixture
rules; parallelism is between runners. All existing test projects still run.

The always-running **CI gate** requires classification/docs success and every
applicable application job to succeed. Failure, cancellation or an unexpected
skip refuses the gate. The explicit docs path requires application jobs to be
skipped and emits a successful docs gate, keeping the required check present.

After the gate passes, a small receipt records source commit/tree, verification
workflow blob, run ID/attempt, PR/head and application-vs-docs scope. It contains
no bindings, database state or credential values. Receipts last 30 days; test
bundles last 3 days and synthetic browser failure reports/traces last 7 days.
No application data-retention policy changes. Missing receipts cause fresh CI.

The shared setup action caches pnpm downloads keyed by OS/toolchain/lockfile and
always uses the frozen lockfile. Next.js compiler caches are separate for local
test builds and staging builds. No `.dev.vars`, `.env`, `.wrangler` state or test
database is transferred. PR jobs never receive the staging Cloudflare token.

## Main delivery

`deploy-staging.yml` runs on main pushes or manual requests on main. It checks
current main and classifies the actual change. Docs-only changes check links and
skip both application verification and deployment; the live revision therefore
continues to identify the last application release, not the latest docs commit.

For application releases the plan job uses a read-only GitHub token to find the
merged same-repository PR and successful `verify.yml` run on its exact head.
It downloads only that run attempt's small receipt, never PR-built application
code. Reuse requires application coverage, matching repository/PR/head/run/attempt,
the same complete Git tree and verification workflow blob as current main, and
confirmation of the recorded commit tree through GitHub. GitHub may clear a run's
PR list after merge, so the merged-commit association and receipt bind the PR.

Missing, expired, malformed, oversized, failed, cancelled, unrelated, fork or
mismatched evidence calls `verify.yml` with `force_full=true`. An API/download
problem also takes this conservative path. Deployment requires either equivalent
successful PR proof or a successful full fallback; it cannot proceed after failed
classification, missing job results, failed/cancelled fallback or a non-main run.

The deployment job serializes releases, checks for stale main before setup/build
and again before upload, and builds from trusted main source using staging config.
The Cloudflare token is present only in the schema-check/deploy step through the
existing `staging` environment secret. The account remains selected by the existing
Wrangler staging config. Remote migrations/seeds/resets/password rotation remain
absent. The migration inventory and exact-revision HTTPS smoke still gate success.
An in-flight deployment is not automatically cancelled. Smoke failure reports a
failed release for investigation, without automatic code/data rollback.

## Owner setup: protect main

The connected GitHub app cannot write repository administration settings. After
this PR exposes a successful `CI gate`, use repository **Settings → Branches →
Add branch protection rule** (or the equivalent active branch ruleset):

1. Target `main`.
2. Require a pull request before merging; leave required reviewer count at zero.
3. Require status checks, selecting **CI gate** from GitHub Actions.
4. Require the branch to be up to date before merging (strict checks).
5. Apply the rule to administrators too; keep force pushes and deletion disabled.

The user authorized these settings with the recommendation; manual entry is a
connector capability limitation, not a new approval requirement. Verify the
applied rule afterward. Do not require an obsolete `verify` job or invent a
CODEOWNERS/reviewer. Workflow reuse still checks exact source equivalence even
after protection is enabled. The full fallback remains a safety path for unusual
pushes, expired proof and manual recovery, not permission to bypass branch rules.

## Recovery and acceptance evidence

Use **Actions → Deploy staging → Run workflow → main** to redeploy current main.
Equivalent PR proof can be reused; otherwise full verification runs first. This
is not a historical rollback button. **Verify application → Run workflow** runs
verification only. Old application releases and real-service recovery retain the
limits in [release and recovery](release-and-recovery.md).

Record exact-head PR jobs, desktop/phone overlap, bundle transfer, docs-only gate,
fallback/refusal regression results and actual main deployment in the PR/status.
The old successful release is not evidence that the new reuse path has executed.
Runtime remains fictional-account staging; jobs/email/production remain deferred.
