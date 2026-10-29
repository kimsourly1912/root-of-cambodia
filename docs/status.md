# Current implementation and verification status

**Status:** current source baseline; no staging/production readiness established.

**Responsible role:** delivery maintainer (responsibility, not an assigned person).

**Last source verification:** 29 October 2026; guest-browsing planning based on merged main [d7e70bb](https://github.com/kimsourly1912/root-of-cambodia/commit/d7e70bbe9d0c0d18b34cfedaf4d143b0f59f89d2).

**Sources:** [.github/workflows/verify.yml](../.github/workflows/verify.yml), [apps/web/app/](../apps/web/app), [apps/jobs/src/index.ts](../apps/jobs/src/index.ts), [apps/web/src/runtime.ts](../apps/web/src/runtime.ts), [apps/jobs/src/runtime.ts](../apps/jobs/src/runtime.ts).

This is the single current delivery/evidence page. Feature docs define contracts; archive reviews retain older results without becoming additional roadmaps.

## Baseline and evidence

The documentation foundation is merged in [PR #16](https://github.com/kimsourly1912/root-of-cambodia/pull/16), main commit [ed7035c6c267232d94537d94b5fc91806e4715b6](https://github.com/kimsourly1912/root-of-cambodia/commit/ed7035c6c267232d94537d94b5fc91806e4715b6), tree bd2146dd5bcb1261af61812997feaf34fd3cd440. Its [CI run 40862202635](https://github.com/kimsourly1912/root-of-cambodia/actions/runs/40862202635) passed. The dependency patch is [PR #17](https://github.com/kimsourly1912/root-of-cambodia/pull/17), head b653b57b711e0d03aebb8e119f9df10e0c31f8b3. Its [CI run 40867423899](https://github.com/kimsourly1912/root-of-cambodia/actions/runs/40867423899) passed. PR #17 is now merged at ae98c8af4e066fa2be1bacf882105ff682332726. The owner-detail [PR #18](https://github.com/kimsourly1912/root-of-cambodia/pull/18) is merged at 484989df749689f797aa125ccf590e7eba0b0cb6; its [CI run 40869589613](https://github.com/kimsourly1912/root-of-cambodia/actions/runs/40869589613) passed 140 Vitest tests and 14 desktop/phone browser checks. PR #18 merged with the identical tested owner-detail tree f44d82723b3d76e12e014c52b4144068b0442781. Publication review was built on that baseline; its later merge is recorded below.

### Dependency base (PR #17)

The owner subsequently authorized the bounded dependency investigation/fix and relevant local checks. Only the pinned @node-minify/core@9.0.2 dependency on glob is overridden, from 10.3.3 to 10.5.0. OpenNext, Next.js, direct dependency versions, the package-manager lock document, native-build permissions and release-age policy are unchanged. Required helper changes are jackspeak 2.3.6 → 3.4.3 and new package-json-from-dist 1.0.1; every other existing package/version/integrity is retained.

The [maintainer advisory GHSA-5j98-mcp5-4vw2](https://github.com/isaacs/node-glob/security/advisories/GHSA-5j98-mcp5-4vw2) affects the glob CLI command-execution option, not ordinary library APIs. Installed source inspection found the OpenNext minifier uses the core library, whose wildcard expansion calls globSync; no vulnerable CLI invocation was found in that inspected chain or repository scripts. This is a bounded reachability assessment, not proof about every possible consumer. The override removes the affected copy without relying solely on that assessment.

Fresh verification on 29 October 2026 used Linux, Node 24.22.1 and pnpm 12.15.0 with synthetic local data:

| Check | Current result |
| --- | --- |
| Before/after active-workspace pnpm audit --json | One high advisory → zero reported advisories |
| Regenerated lockfile and frozen installation | Passed; narrow dependency-closure change only; 537 existing package records retained unchanged |
| Actual ESM minifier wildcard smoke | Passed; resolves glob 10.5.0 and correctly combines/minifies two fixture files |
| Local initialization and binding generation | Passed; all existing migrations applied locally; no SQL files changed |
| Strict backend/web/jobs/test types | Passed |
| Next.js/OpenNext Worker and jobs dry-run builds | Passed; no deployment |
| Vitest | Passed for the dependency base; historical owner/publication totals below |
| Local Playwright browser installation | Blocked: matching Chromium 156.0.8078.4 download returned an invalid/truncated ZIP; no executable override or version downgrade |
| Browser execution / PR CI | Dependency PR #17 CI passed matching-browser desktop/phone checks; no local browser pass claimed; owner/publication changes have their own CI results |

These are local-emulator results, not staging/live verification. Zero audit findings is the registry audit result at this time, not a security certification. The independent historical proof was not dependency-audited or changed; its older lockfile is outside this fix. glob 10.x still has an upstream deprecation notice; removing the override requires a separately verified parent/adapter update that no longer pins an affected copy.

Historical audit/photo evidence remains in the [archive](archive/README.md), with original dates/commits/results. New PR CI evidence belongs to its actual SHA/run and must not be confused with earlier baseline runs.

## Delivery state

| Capability | Implementation state | Verification boundary / remaining work |
| --- | --- | --- |
| Accounts | Implemented locally | Email/password, email verification, recovery, verified private owner access; auth mail is local capture |
| Owner supply | Implemented private draft subset | Property basics, room types, weekly USD prices/stock, information, private photos and private location/contact/arrival notes; [contract](features/owner-supply.md) |
| Booking foundation | Implemented API/database subset | Quotes, submission/detail, accept/decline/cancel/expiry, external allocation and inventory; [contract](features/bookings.md) |
| Arrival/completion | Blocked/incomplete | `check_in` rejects with decision-required; complete requires an already checked-in record; no complete stay lifecycle |
| Notifications | Implemented local substitute | Outbox, queues, lease fencing/backoff and capture; real sending/reminders/operations remain incomplete |
| Discovery/destinations | Planned | No public search/catalog/destination journey in active app |
| Guest and owner booking screens | Planned | Backend routes are not a complete booking/list/management UI |
| Publication review | Implemented local pilot subset | Owner submit/withdraw, configured sole reviewer, correction notes, immutable snapshots and terms-gated approval; [contract](features/publication-review.md) |
| Partner/admin/support | Planned | No general partner/contact submission, broad account/moderation or support dashboard |
| Other-category reservations/payments | Deferred | Accommodation-first, pay-at-property v1 remains accepted policy |
| Language/design | Partial | Khmer names/fonts and some labels; predominantly English working UI, not full Khmer localization |

Implementation-plan steps 1–5 and the later pnpm amendment are recorded as locally completed history. Step 6 remains partial owner-supply/product work. Historical next-step lists do not override this table.

## Current private owner-detail slice

Merged PR #18 added the Location & contact tab and private GET/PATCH /api/owner/properties/:id/logistics. Owners can save/reopen/clear optional paired coordinates, informational contact name/phone/email and arrival notes. It uses the existing verified-owner, independent revision, atomic history/receipt and same-attempt recovery patterns. Migration 0010 is additive; earlier migrations and booking/stock/quote/provider behavior are unchanged.

Fresh Linux/pinned-toolchain local checks include frozen install, local initialization/binding generation, strict types, both Worker builds and 140 Vitest tests across 17 files. Nine new native scenarios cover absent/cleared details, permissions/replay, competing saves, uncertain commit recovery, commit-time revocation/state/absence races, audit rollback/SQL guards, validation, unchanged booking data and populated upgrades. The legacy upgrade snapshot check accounts for two new empty extension tables.

A new Playwright journey covers save/reopen/clear, paired-coordinate validation, lost-response same-key/body recovery, stale tabs, private/Origin refusal and phone-width overflow, in both existing browser projects. Local matching-browser installation remains blocked as above; PR #18's CI supplies that slice's browser outcomes. No new local browser pass or manual visual/accessibility review is claimed.

All details stay owner-private and do not change sign-in email, enable arrival/check-in, choose a map provider, publish a listing or define guest disclosure. The later merged publication work adds the bounded review procedure below; the minimum checklist is now approved as recorded below; guest disclosure and arrival remain open. See the [feature contract](features/owner-supply.md#private-location-contact-and-arrival-details).

## Environment scope

| Environment | Established evidence | Not established |
| --- | --- | --- |
| Local emulators / historical GitHub CI | Native workerd/D1, emulated R2/Images, actual built web/jobs Workers and Chromium desktop/phone emulation | Real providers, resource permissions/quotas/costs, HTTPS production sessions and full Images fidelity |
| Staging | No configured staged resources or staging validation established by this repository review | Live D1/Queues/Cron/R2/Images/email, failure recovery/load/restore |
| Production/pilot | No production readiness established | Deployment/account state, deliverability, operator readiness, recovery, performance and pilot usability |

Earlier Windows network/browser-override notes remain historical environment evidence; they do not invalidate the matching-browser CI pass or establish today's PC setup. External Cloudflare account/deployed traffic/secrets were not inspected.

## Merged publication workflow

The project owner authorized merging PRs #17/#18 and starting the recommended next slice. Merged branch feat/pilot-publication-review added owner submission/withdrawal, a private oldest-first reviewer queue, correction notes/resubmission and explicit terms-gated approval. The project owner is the sole pilot reviewer; a trusted local command assigns the deliberately chosen verified app user ID. There is no self-service grant, first-user admin shortcut or inferred app identity. Migration 0011 is additive and earlier SQL/booking operation roles/receipts remain unchanged.

[PR #19](https://github.com/kimsourly1912/root-of-cambodia/pull/19) is now merged at d53544cbee11def8e2522a33075235ba0abe73e0. Its tree 95d0f058c67ce04b5f875d1c97b5c5fb15c938e7 exactly matches tested head 50dd627ff03a767e83cb17e6fdea00302c72a116. [CI run 40878754892](https://github.com/kimsourly1912/root-of-cambodia/actions/runs/40878754892), job 123464299762, passed frozen installation, local initialization/bindings/types, both builds, 153 Vitest tests and all 16 matching-Chromium desktop/phone checks. This is historical CI evidence for the merged source tree, not a fresh local browser run or live-service verification.

Submission freezes saved draft editing. Snapshots/events/receipts are atomic and immutable; current verification/ownership/reviewer assignment/config revision and submitted data are fenced at commit. Approval sets an explicitly configured approved booking-terms version and publishes the property. Empty terms configuration blocks approval. That release retained preparation reminders; the subsequently approved minimum is implemented in merged PR #21 below. Review-photo access is private and processed-only. No guest contact/public discovery/media workflow, support impersonation, arrival action or provider/deployment change is added.

For PR #19, Linux/pinned-toolchain checks passed frozen installation, all 11 local migrations, binding generation, strict types, both Worker builds, 153 Vitest tests across 18 files (including 13 new native review scenarios and added built-Worker HTTP assertions), zero reported audit advisories and 738 repository links/anchors. Matching-head CI and browser outcomes are recorded in merged PR #19 and its run above. The earlier PR counts above remain historical evidence for their own commits. Local matching-browser download is unavailable as documented; matching-browser PR CI supplies browser execution evidence. No manual visual/accessibility or live-pilot acceptance is claimed.

## Merged follow-up (PR #20)

[PR #20](https://github.com/kimsourly1912/root-of-cambodia/pull/20) is merged at 99e8350afd1b0aeca035e8707d428d6865fdb8dc. It corrected the unfinished-photo label and JSON creation diagnostic status, repaired the migration-table formatting and prepared the checklist proposal. Its tree 1e4bea220ec4d1a0f607f274b96320ce50c58ee6 matches tested head 69a5542ddf8a5cd57f475e9e6b381f8b8ec927d4; [CI run 40884454769](https://github.com/kimsourly1912/root-of-cambodia/actions/runs/40884454769), job 123484311796, passed installation, initialization/bindings/types, both builds, full Vitest and matching-browser desktop/phone checks. The checklist was still proposed at that release; subsequent approval follows below.

Historical PR #20 local verification on Linux, Node 24.22.1 and pnpm 12.15.0:

| Check | Actual result |
| --- | --- |
| corepack pnpm install --frozen-lockfile | Passed; pins/lockfile unchanged |
| corepack pnpm init:local; corepack pnpm types:bindings | Passed; existing 11 migrations applied to fresh local state, no SQL changed |
| corepack pnpm typecheck | Passed across backend/web/jobs/tests |
| corepack pnpm build:worker; corepack pnpm build:jobs | Passed; actual web bundle and jobs dry run, no deployment |
| corepack pnpm test | 154 tests passed across 18 files; includes retained publication cases and a built-Worker check matching the 201 response to its correlated completion log |
| Changed-document links/anchors; git diff --check | 113 local links/anchors passed; whitespace passed |
| corepack pnpm exec playwright install chromium | Blocked; matching Chromium 156.0.8078.4 archive was invalid/truncated, so no fresh local browser pass claimed |

The new diagnostics test covers 200, 201 and status-free scheduled completion; the existing privacy/sink-failure regressions remain. Historical PR #19 browser evidence above applies to its baseline tree. Matching-head PR #20 CI passed as recorded above; its browser evidence applies to that source tree. No fresh audit, manual visual/accessibility, staging or production verification is claimed by these checks.

## Merged minimum checklist (PR #21)

The project owner accepted the minimum checklist on 29 October 2026, replying “Yes please continue and approve” after PR #20. [D05 approval](product/open-decisions.md#minimum-publication-checklist--29-october-2026) and the [accepted checklist](product/publication-checklist-proposal.md) preserve the scope. The implementation branch feat/publication-readiness started from main 99e8350. This is implementation/testing, not staging or pilot readiness. Actual account identity/terms, guest disclosure, merge/deployment and wider publication policies are not inferred.

The merged implementation adds one shared checklist projection/predicate for owner/reviewer guidance, service validation and atomic submit/approval guards. Incomplete private drafts still save; new submission/approval requires the approved minimum. Calendar checks use D1 time and scheduled Cambodia check-in >=24 hours ahead, ignoring reserved/blocked counts for completeness. Return/withdraw still works when a pending request becomes incomplete; earlier successful receipts replay and published properties are not automatically unpublished. No SQL migration, dependency version/lockfile or runtime/provider configuration changes are introduced.

Owner drafts show missing-item links and disabled submission; reviewers see the same current checks and can return corrections when approval is blocked. A stale incomplete response asks for reload, while uncertain outcomes keep the same key/payload. Existing snapshots, booking operations and migration SQL remain unchanged. The historical built-Worker unknown-error fixture now renames its rate table rather than dropping referenced history; the same 503/privacy assertions remain.

Historical PR #21 local checks on Linux, Node 24.22.1 and pnpm 12.15.0:

| Command/scenario | Actual outcome |
| --- | --- |
| corepack pnpm install --frozen-lockfile; corepack pnpm types:bindings | Passed; no dependency version/lock/config change |
| corepack pnpm typecheck | Passed backend/web/jobs/tests |
| corepack pnpm build:worker; corepack pnpm build:jobs | Passed actual web bundle and jobs dry run; no deployment |
| corepack pnpm test | 164 passed across 19 files; all earlier 154 cases retained, plus ten native checklist cases |
| Focused publication/checklist | 23 passed, retaining all earlier 13 publication cases with complete prerequisite fixtures |
| corepack pnpm test:worker | Both built-Worker journeys passed, including direct incomplete refusal, private readiness and the retained 12 historical HTTP checks |
| Documentation targets/anchors; git diff --check | Passed; exact link count and source tree in PR evidence |
| Browser | Extended desktop/phone journey passed matching-head CI; local matching Chromium remained unavailable after the truncated download |

New native coverage includes each missing requirement/optional fields, retained whitespace-only text (including tabs and Unicode spaces), matching future dates/active rooms/positive stock, exact 24-hour/leap-day/midnight eligibility, time and capacity races without snapshot changes, direct persistence bypass refusal with atomic rollback, retained legacy pending/receipts, fully reserved/blocked stock and unfinished uploads. Fixed-clock tests replace only the clock expression in isolated native SQL; no production clock or fixture route is added. Existing auth/revocation/concurrency/history/upgrade/booking tests remain.

[PR #21](https://github.com/kimsourly1912/root-of-cambodia/pull/21) is now merged at d7e70bbe9d0c0d18b34cfedaf4d143b0f59f89d2. Its tree 67544375b806e01d9cb72e740789ff93eeccd1ff exactly matches final tested head 2a93230c8b08342c5f22ad457d2c8e7745a4ad4e. [Final CI run 40889799436](https://github.com/kimsourly1912/root-of-cambodia/actions/runs/40889799436), job 123503175268, passed frozen install, all 11 fresh local migrations, bindings/types, both Worker builds, full Vitest and matching-Chromium desktop/phone checks. This is historical evidence for that merged source tree, not a fresh run during the next planning phase. No fresh audit, local browser, manual visual/accessibility, real-device, staging or production pass is claimed.

## Current work and authorization

Following the merge of PR #21, the owner requested the next step. Branch docs/guest-browsing-plan starts from the confirmed updated main d7e70bb and prepares a [concrete first guest-browsing proposal](product/guest-browsing-proposal.md). The source review confirms that current review packets contain private address/contact/arrival fields, photos are served through private readers, and public list/detail routes are absent. The current scope is product/architecture planning before implementation of a new anonymous read boundary.

The proposal recommends read-only stay browsing/detail pages, a public field allowlist, processed-only gallery delivery with the first photo as cover, explicit owner public-display acknowledgement and conservative handling of earlier approvals. It explains scope, alternatives, cost/maintenance implications, old-data boundaries and acceptance tests. These choices remain proposed; neither “Ok next” nor an existing publication approval silently authorizes public disclosure. Full guest booking-state logistics disclosure/snapshot rules remain D17.

Only documentation changes in this phase: current merge/evidence status, the proposed slice and decision links, plus clarification that narrow publication review exists while broad admin/support does not. No application, dependency, schema, configuration, resource, repository-setting or data changes are made. Appropriate verification is source/scope inspection, Markdown links/anchors and whitespace. No install, initialization/migration, application build/test, deployment or new publication is performed or claimed by this planning phase.

## Follow-ups requiring separate scope or decisions

| Priority | Follow-up | Boundary |
| --- | --- | --- |
| Publication pilot | Select verified local reviewer account and approve actual booking terms/version | Local setup supports explicit assignment; approval fails closed without terms; the D05 minimum is accepted; broader D05 and D15 legal/privacy remain open |
| Governance | A04: required verification/review policy and real code reviewer assignment | Existing settings not changed; D18 approval needed |
| Before public exposure | A02/A03: provider/environment path and action/upload/storage abuse budgets | Preserve local fail-closed guards; D07/D08/D11 before nonlocal work |
| Policy/recovery | Arrival, support, retention/erasure and recovery ownership | [Open decisions](product/open-decisions.md), especially D01/D06/D09/D10/D17 |
| Pilot quality | Khmer copy, accessibility, slow-device/performance and real-service validation | No full accessibility, cross-engine/device or capacity certification |
| Guest journey | Agree on the [first browsing proposal](product/guest-browsing-proposal.md) before implementation | D05/public display choices remain proposed; D17 booking-state disclosure is outside this first slice |

Next: the project owner agrees with or amends the public/private split, routed processed-photo delivery and explicit public-display acknowledgement. Then implement the focused local browsing slice. Booking request/detail screens and their private-logistics disclosure contract follow separately. Deliberate reviewer-account selection, actual approved terms and staged/live release gates remain open.
