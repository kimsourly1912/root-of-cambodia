# Current implementation and verification status

**Status:** current source baseline; no staging/production readiness established.

**Responsible role:** delivery maintainer (responsibility, not an assigned person).

**Last source verification:** 29 October 2026; publication candidate based on merged main [484989d](https://github.com/kimsourly1912/root-of-cambodia/commit/484989df749689f797aa125ccf590e7eba0b0cb6).

**Sources:** [.github/workflows/verify.yml](../.github/workflows/verify.yml), [apps/web/app/](../apps/web/app), [apps/jobs/src/index.ts](../apps/jobs/src/index.ts), [apps/web/src/runtime.ts](../apps/web/src/runtime.ts), [apps/jobs/src/runtime.ts](../apps/jobs/src/runtime.ts).

This is the single current delivery/evidence page. Feature docs define contracts; archive reviews retain older results without becoming additional roadmaps.

## Baseline and evidence

The documentation foundation is merged in [PR #16](https://github.com/kimsourly1912/root-of-cambodia/pull/16), main commit [ed7035c6c267232d94537d94b5fc91806e4715b6](https://github.com/kimsourly1912/root-of-cambodia/commit/ed7035c6c267232d94537d94b5fc91806e4715b6), tree bd2146dd5bcb1261af61812997feaf34fd3cd440. Its [CI run 40862202635](https://github.com/kimsourly1912/root-of-cambodia/actions/runs/40862202635) passed. The dependency patch is [PR #17](https://github.com/kimsourly1912/root-of-cambodia/pull/17), head b653b57b711e0d03aebb8e119f9df10e0c31f8b3. Its [CI run 40867423899](https://github.com/kimsourly1912/root-of-cambodia/actions/runs/40867423899) passed. PR #17 is now merged at ae98c8af4e066fa2be1bacf882105ff682332726. The owner-detail [PR #18](https://github.com/kimsourly1912/root-of-cambodia/pull/18) is merged at 484989df749689f797aa125ccf590e7eba0b0cb6; its [CI run 40869589613](https://github.com/kimsourly1912/root-of-cambodia/actions/runs/40869589613) passed 140 Vitest tests and 14 desktop/phone browser checks. Main has the identical tested owner-detail tree f44d82723b3d76e12e014c52b4144068b0442781. This candidate starts from that merged main.

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
| Vitest | Passed for the dependency base; current owner-candidate totals below |
| Local Playwright browser installation | Blocked: matching Chromium 156.0.8078.4 download returned an invalid/truncated ZIP; no executable override or version downgrade |
| Browser execution / PR CI | Dependency PR #17 CI passed matching-browser desktop/phone checks; no local browser pass claimed; owner candidate has its own CI result |

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

A new Playwright journey covers save/reopen/clear, paired-coordinate validation, lost-response same-key/body recovery, stale tabs, private/Origin refusal and phone-width overflow, in both existing browser projects. Local matching-browser installation remains blocked as above; this candidate's PR CI is authoritative for browser outcomes. No new local browser pass or manual visual/accessibility review is claimed.

All details stay owner-private and do not change sign-in email, enable arrival/check-in, choose a map provider, publish a listing or define guest disclosure. The current candidate adds the bounded review procedure below; required publication fields/disclosure and arrival remain open. See the [feature contract](features/owner-supply.md#private-location-contact-and-arrival-details).

## Environment scope

| Environment | Established evidence | Not established |
| --- | --- | --- |
| Local emulators / historical GitHub CI | Native workerd/D1, emulated R2/Images, actual built web/jobs Workers and Chromium desktop/phone emulation | Real providers, resource permissions/quotas/costs, HTTPS production sessions and full Images fidelity |
| Staging | No configured staged resources or staging validation established by this repository review | Live D1/Queues/Cron/R2/Images/email, failure recovery/load/restore |
| Production/pilot | No production readiness established | Deployment/account state, deliverability, operator readiness, recovery, performance and pilot usability |

Earlier Windows network/browser-override notes remain historical environment evidence; they do not invalidate the matching-browser CI pass or establish today's PC setup. External Cloudflare account/deployed traffic/secrets were not inspected.

## Current publication candidate

The project owner authorized merging PRs #17/#18 and starting the recommended next slice. Branch feat/pilot-publication-review adds owner submission/withdrawal, a private oldest-first reviewer queue, correction notes/resubmission and explicit terms-gated approval. The project owner is the sole pilot reviewer; a trusted local command assigns the deliberately chosen verified app user ID. There is no self-service grant, first-user admin shortcut or inferred app identity. Migration 0011 is additive and earlier SQL/booking operation roles/receipts remain unchanged.

Submission freezes saved draft editing. Snapshots/events/receipts are atomic and immutable; current verification/ownership/reviewer assignment/config revision and submitted data are fenced at commit. Approval sets an explicitly configured approved booking-terms version and publishes the property. Empty terms configuration blocks approval. Preparation reminders remain guidance while D05 required fields are open. Review-photo access is private and processed-only. No guest contact/public discovery/media workflow, support impersonation, arrival action or provider/deployment change is added.

Fresh Linux/pinned-toolchain checks passed frozen installation, all 11 local migrations, binding generation, strict types, both Worker builds, 152 Vitest tests across 18 files (including 12 new native review scenarios and added built-Worker HTTP assertions), zero reported audit advisories and 738 repository links/anchors. Matching-head CI and browser outcomes are recorded in the candidate PR. The earlier PR counts above remain historical evidence for their own commits. Local matching-browser download is unavailable as documented; matching-browser PR CI supplies browser execution evidence. No manual visual/accessibility or live-pilot acceptance is claimed.

## Current work and authorization

Documentation and dependency/private owner-detail work are merged. The user explicitly authorized both merges and starting the recommended publication slice on 29 October 2026. The narrow reviewer responsibility is recorded in [D05](product/open-decisions.md#pilot-reviewer-decision--29-october-2026). Application account assignment and approved legal terms have not been guessed. No deployment, remote migration, repository-setting mutation or broader support/admin assignment is authorized or performed by this candidate.

## Follow-ups requiring separate scope or decisions

| Priority | Follow-up | Boundary |
| --- | --- | --- |
| Publication pilot | Select verified local reviewer account and approve actual booking terms/version | Local setup supports explicit assignment; approval fails closed without terms; D05 required checklist and D15 legal/privacy remain open |
| Governance | A04: required verification/review policy and real code reviewer assignment | Existing settings not changed; D18 approval needed |
| Before public exposure | A02/A03: provider/environment path and action/upload/storage abuse budgets | Preserve local fail-closed guards; D07/D08/D11 before nonlocal work |
| Policy/recovery | Arrival, support, retention/erasure and recovery ownership | [Open decisions](product/open-decisions.md), especially D01/D06/D09/D10/D17 |
| Pilot quality | Khmer copy, accessibility, slow-device/performance and real-service validation | No full accessibility, cross-engine/device or capacity certification |
| Small source follow-up | Diagnostics success status can differ from creation response; photo UI has a stray replacement character | Audit A11/A10; unchanged here; separate focused code/copy fix |

Next: review the publication candidate and validate the local owner → reviewer → corrections → approval journey with explicitly approved terms. Then settle the publication checklist before public discovery work. These source changes do not establish public-pilot readiness.
