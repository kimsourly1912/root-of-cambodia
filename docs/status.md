# Current implementation and verification status

**Status:** current snapshot; interactive Cloudflare staging with fictional accounts verified; email and pilot/production readiness deferred.

**Responsible role:** delivery maintainer (responsibility, not an assigned person).

**Last source verification:** 31 October 2026; main [fdcfdad](https://github.com/kimsourly1912/root-of-cambodia/commit/fdcfdad99876bb17f4cdd3cbf63824fbd6586e63) after PR #37; staging delivery prepared on `feat/staging-auto-deploy`, pending activation.

**Sources:** [.github/workflows/verify.yml](../.github/workflows/verify.yml), [apps/web/app/](../apps/web/app), [packages/backend/migrations/](../packages/backend/migrations/), [apps/web/server/runtime.ts](../apps/web/server/runtime.ts), [apps/jobs/src/runtime.ts](../apps/jobs/src/runtime.ts), [staging contract](operations/staging.md).

This is the single current delivery page: what exists, what evidence supports it and what comes next. It is a snapshot, not a log. Per-PR narrative, failed-run repairs, deployment IDs and older counts live in the PRs, the [staging contract](operations/staging.md) and the [status log through PR #35](archive/2026-10/status-log-2026-10-30.md). Update rules are at the end of this page.

## Baseline

| Item | Current value |
| --- | --- |
| Main | fdcfdad, merge of [PR #37](https://github.com/kimsourly1912/root-of-cambodia/pull/37); tree matches CI-tested head 3101fed |
| Migrations | 0001–0020 in [packages/backend/migrations](../packages/backend/migrations/); latest is 0020_reviewed_listing_corrections. Applied locally and to staging D1 |
| Toolchain | Node 24.22.1, pnpm 12.15.0 ([setup](development/setup.md)) |
| Environments | Local emulators, GitHub CI, and Cloudflare staging in `staging-test` mode ([staging contract](operations/staging.md)). No production |

## Verification evidence

| Evidence | Scope | Result |
| --- | --- | --- |
| [CI 41174032239](https://github.com/kimsourly1912/root-of-cambodia/actions/runs/41174032239), #37 source 3101fed | Current main source | Frozen install, setup/bindings/types, both builds, 225 Vitest across 30 files, 28/28 matching-Chromium desktop/phone checks; this is not deployed-staging evidence |
| [CI 41017754998](https://github.com/kimsourly1912/root-of-cambodia/actions/runs/41017754998), #34 head e763dcc | Previous main 40f7ffa | All steps succeeded; 217 Vitest and 26 desktop/phone browser checks |
| Staging HTTPS smoke, 30 October | Deployed 5d1fa92 runtime with fixture data | 58 real HTTPS checks passed: catalog/stay pages, three-account sessions and cookies, private reads and cross-role refusal, processed public photos, no-store/noindex, disabled registration/recovery, wrong-Origin refusal, sign-out. Remote integrity/FK checks passed |

CI results are GitHub Ubuntu/emulator runs. Staging evidence covers fictional fixture accounts only. Not established: manual signed-in browser testing, phone hardware, accessibility review, load/restore, email delivery, deployed jobs, production. Local matching-Chromium download has repeatedly failed; browser automation evidence comes from PR CI.

## Delivery state

| Capability | State | Contract / remaining work |
| --- | --- | --- |
| Accounts | Local; staging fixture-only | Email/password, verification, recovery locally (mail is local capture). Staging admits three fictional accounts; registration/recovery disabled until email (D07) |
| Owner supply | Implemented private drafts | Basics, rooms, weekly USD prices/stock, information, private photos, private location/contact/arrival; [owner supply](features/owner-supply.md) |
| Owner inventory operations | Implemented (#29, #30) | One-night capacity/blocked updates and catalog-priced anonymous external reservations; [scope](product/owner-inventory-operations.md). Wider D04 open |
| Publication review | Implemented pilot flow | Submit/withdraw, sole configured reviewer, minimum checklist, snapshots, terms-gated approval; [publication review](features/publication-review.md) |
| Listing pause/resume and offline corrections | Implemented (#33, #34) | Owner pause/resume with unchanged approval; reopen to draft, re-acknowledge and manual re-review; [ADR 0007](architecture/decisions/0007-owner-listing-controls.md) |
| Guest stay browsing | Implemented; on staging | Anonymous allowlisted search/province/detail and processed photos; [guest browsing](features/guest-browsing.md). Destinations/maps later |
| Booking engine and screens | Implemented; on staging | Quotes/snapshots, guest request/track/cancel, owner accept/decline/cancel, status filters (#31), D17 confirmed-only logistics; [bookings](features/bookings.md) |
| Arrival/completion | Implemented ordinary flow | Schedule-bounded owner check-in and manual completion; no-show, overrides and post-check-in cancellation open (D01) |
| Payment records | Implemented | Full pay-at-property attestation with private correction history; no money movement; [payments](features/payments.md) |
| Notifications and jobs | Local substitute only | Outbox, queue, leases, capture locally; jobs, queue consumer, Cron, expiry/cleanup sweeps and email not deployed (D07); [notifications](features/notifications.md) |
| Automatic staging delivery | Prepared; activation unverified | Main verification → serialized web deployment → revision-aware HTTPS smoke; [staging pipeline](operations/staging.md#automatic-web-deployments-from-main). Needs GitHub staging environment/token, merge and first successful deployment |
| Partner/admin/support | Planned | No broad account, moderation or support dashboard (D06) |
| Language/design | Partial | Khmer fonts/names and some labels; working UI mostly English (D13) |
| Other-category reservations, online payment | Deferred by [scope](product/scope.md) | Reopen only by explicit scope decision |

## Environment scope

| Environment | Established | Not established |
| --- | --- | --- |
| Local emulators / GitHub CI | Native workerd/D1, emulated R2/Images, built web/jobs Workers, Chromium desktop/phone emulation | Real providers, quotas/costs |
| Staging ([contract](operations/staging.md)) | Isolated D1 (0001–0020), private R2, Images binding, web Worker on staging.rootsofcambodia.com only; fictional fixture data created through normal APIs; 58 HTTPS smoke checks | Email, jobs/queue consumer/Cron, real users or data, load/restore, manual signed-in and phone testing |
| Production/pilot | Nothing established; apex unchanged | Deployment, deliverability, operator readiness, recovery, pilot usability |

Release requirements are in [release and recovery](operations/release-and-recovery.md).

## Next steps and blockers

| Priority | Item | Needs |
| --- | --- | --- |
| 1 | Owner evaluates the staging preview with the fixture accounts | Project owner; passwords are delivered outside git |
| 2 | Real email sending, then account registration/recovery and booking notifications on staging | Owner's Cloudflare upgrade; D07 |
| 3 | Pilot reviewer account and approved booking terms text/version | Project-owner action; D15 legal text |
| 4 | Exceptional stay handling: no-show, early/late, post-check-in cancellation | D01 decision proposal before code |
| 5 | Admin/support powers and suspended-owner handling | D06 decision |
| 6 | Deployed jobs, abuse budgets, retention, recovery | D08, D09, D10, D11 |
| 7 | Khmer copy, accessibility, real-device and performance review | D13 ownership |
| 8 | Repository governance: required checks, reviewers | D18; settings changes need separate authorization |
| — | Activate the prepared main-to-staging pipeline; feature layout, shared UI/forms and navigation work are merged in main | GitHub staging credentials/environment, reviewed workflow merge and first successful main deployment/smoke |

Policy-sensitive items start with a decision proposal (see [playbooks](playbooks/README.md)), not code.

## Updating this page

- Keep it a snapshot of at most about 120 lines. Replace rows; do not append dated narrative sections.
- Record the merge SHA, migration range and the exact-head CI run for the current main. Cite counts only with their run link.
- Put repair history, failed-run explanations, deployment IDs and per-command tables in the PR body or the [staging contract](operations/staging.md).
- When detail is superseded, move it to the archive with a historical banner instead of keeping it here.
