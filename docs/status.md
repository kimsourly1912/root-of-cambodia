# Current implementation and verification status

**Status:** current snapshot; no staging/production readiness established.

**Responsible role:** delivery maintainer (responsibility, not an assigned person).

**Last source verification:** 31 October 2026; main [40f7ffa](https://github.com/kimsourly1912/root-of-cambodia/commit/40f7ffa553a14005f622aa5c846f0f9dc5e70f42) after PR #34.

**Sources:** [.github/workflows/verify.yml](../.github/workflows/verify.yml), [apps/web/app/](../apps/web/app), [packages/backend/migrations/](../packages/backend/migrations/), [apps/web/src/runtime.ts](../apps/web/src/runtime.ts), [apps/jobs/src/runtime.ts](../apps/jobs/src/runtime.ts).

This is the single current delivery page: what exists, what evidence supports it and what comes next. It is a snapshot, not a log. Per-PR narrative, failed-run repairs and older counts live in the PRs and in the [status log through PR #34](archive/2026-10/status-log-2026-10-30.md). Update rules are at the end of this page.

## Baseline

| Item | Current value |
| --- | --- |
| Main | 40f7ffa, merge of [PR #34](https://github.com/kimsourly1912/root-of-cambodia/pull/34); tree 2d3029c6 is identical to #34 head e763dcc |
| Migrations | 0001–0020 in [packages/backend/migrations](../packages/backend/migrations/); latest is 0020_reviewed_listing_corrections |
| Toolchain | Node 24.22.1, pnpm 12.15.0 ([setup](development/setup.md)) |
| Environments | Local emulators and GitHub CI only; checked-in runtime config fails closed outside local mode |

## Verification evidence

| Evidence | Scope | Result |
| --- | --- | --- |
| [CI 41015058118](https://github.com/kimsourly1912/root-of-cambodia/actions/runs/41015058118), #33 head 2f3719a | Last fully green run recorded in this repository | Frozen install, migrations through 0019, types, both builds, 211 Vitest across 27 files, 26/26 matching-Chromium desktop/phone checks |
| [CI 41016961088](https://github.com/kimsourly1912/root-of-cambodia/actions/runs/41016961088), #34 earlier head | Stage B corrections before the final fix | 217/217 Vitest, 25/26 browser; the mobile stay-completion hydration failure was then fixed in e763dcc |
| #34 final head e763dcc | Current main tree | Merged; its exact-head CI result is **not recorded here** and was not re-inspected on 31 October (GitHub CLI unauthenticated). Check the PR's checks before citing it |

These are GitHub Ubuntu/emulator results. No fresh local browser pass, real device, manual visual/accessibility, staging or live-service verification is established. Local matching-Chromium download has repeatedly failed in past sessions; browser evidence comes from PR CI.

## Delivery state

| Capability | State | Contract / remaining work |
| --- | --- | --- |
| Accounts | Implemented locally | Email/password, verification, recovery; auth mail is local capture only |
| Owner supply | Implemented private drafts | Basics, rooms, weekly USD prices/stock, information, private photos, private location/contact/arrival; [owner supply](features/owner-supply.md) |
| Owner inventory operations | Implemented locally (#29, #30) | One-night capacity/blocked updates and catalog-priced anonymous external reservations; [scope](product/owner-inventory-operations.md). Wider D04 open |
| Publication review | Implemented local pilot | Submit/withdraw, sole configured reviewer, minimum checklist, snapshots, terms-gated approval; [publication review](features/publication-review.md) |
| Listing pause/resume and offline corrections | Implemented locally (#33, #34) | Owner pause/resume with unchanged approval; reopen to draft, re-acknowledge and manual re-review; [ADR 0007](architecture/decisions/0007-owner-listing-controls.md) |
| Guest stay browsing | Implemented local candidate | Anonymous allowlisted search/province/detail and processed photos; [guest browsing](features/guest-browsing.md). Destinations/maps later |
| Booking engine and screens | Implemented locally | Quotes/snapshots, guest request/track/cancel, owner accept/decline/cancel, status filters (#31), D17 confirmed-only logistics; [bookings](features/bookings.md) |
| Arrival/completion | Implemented ordinary flow | Schedule-bounded owner check-in and manual completion; no-show, overrides and post-check-in cancellation open (D01) |
| Payment records | Implemented locally | Full pay-at-property attestation with private correction history; no money movement; [payments](features/payments.md) |
| Notifications | Local substitute | Outbox, queue, leases, capture; no real provider or reminders (D07); [notifications](features/notifications.md) |
| Partner/admin/support | Planned | No broad account, moderation or support dashboard (D06) |
| Language/design | Partial | Khmer fonts/names and some labels; working UI mostly English (D13) |
| Other-category reservations, online payment | Deferred by [scope](product/scope.md) | Reopen only by explicit scope decision |

## Environment scope

| Environment | Established | Not established |
| --- | --- | --- |
| Local emulators / GitHub CI | Native workerd/D1, emulated R2/Images, built web/jobs Workers, Chromium desktop/phone emulation | Real providers, quotas/costs, HTTPS production sessions, full Images fidelity |
| Staging | Nothing configured | Live D1/Queues/Cron/R2/Images/email, recovery, load, restore |
| Production/pilot | Nothing established | Deployment, deliverability, operator readiness, recovery, pilot usability |

Release requirements are in [release and recovery](operations/release-and-recovery.md).

## Next steps and blockers

| Priority | Item | Needs |
| --- | --- | --- |
| 1 | Confirm #34 exact-head CI and record it above | Read access to GitHub checks |
| 2 | Pilot reviewer account and approved booking terms text/version | Project-owner action; D15 legal text |
| 3 | Exceptional stay handling: no-show, early/late, post-check-in cancellation | D01 decision proposal before code |
| 4 | Admin/support powers and suspended-owner handling | D06 decision |
| 5 | Provider/environment path, abuse budgets, retention, recovery | D07, D08, D09, D10, D11 before any nonlocal work |
| 6 | Khmer copy, accessibility, real-device and performance review | D13 ownership |
| 7 | Repository governance: required checks, reviewers | D18; settings changes need separate authorization |

Policy-sensitive items start with a decision proposal (see [playbooks](playbooks/README.md)), not code.

## Updating this page

- Keep it a snapshot of at most about 120 lines. Replace rows; do not append dated narrative sections.
- Record the merge SHA, migration range and the exact-head CI run for the current main. Cite counts only with their run link.
- Put repair history, failed-run explanations and per-command tables in the PR body.
- When detail is superseded, move it to the archive with a historical banner instead of keeping it here.
