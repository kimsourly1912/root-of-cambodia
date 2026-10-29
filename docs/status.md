# Current implementation and verification status

**Status:** current source baseline; no staging/production readiness established.

**Responsible role:** delivery maintainer (responsibility, not an assigned person).

**Last source verification:** 29 October 2026, [607a705](https://github.com/kimsourly1912/root-of-cambodia/commit/607a7057b908a005f9f3529141b0978f52d24ce0).

**Sources:** [.github/workflows/verify.yml](../.github/workflows/verify.yml), [apps/web/app/](../apps/web/app), [apps/jobs/src/index.ts](../apps/jobs/src/index.ts), [apps/web/src/runtime.ts](../apps/web/src/runtime.ts), [apps/jobs/src/runtime.ts](../apps/jobs/src/runtime.ts).

This is the single current delivery/evidence page. Feature docs define contracts; archive reviews retain older results without becoming additional roadmaps.

## Baseline and evidence

On 29 October 2026, GitHub main was compared with audit commit [607a7057b908a005f9f3529141b0978f52d24ce0](https://github.com/kimsourly1912/root-of-cambodia/commit/607a7057b908a005f9f3529141b0978f52d24ce0): **identical; no intervening commits or changed files**. PR #15 (private draft photos) is merged in that baseline; earlier “ready for review”/“unmerged” statements belong to historical reviews.

The source tree is `c036bc32a8a307d519e9dcb24e96123acc0a1244`. Historical [CI run 40827637763](https://github.com/kimsourly1912/root-of-cambodia/actions/runs/40827637763), head `ec5d8d1b71a5f8d1738ecbe08a13db85484863bd`, has the same tree as main. Run metadata, job steps and logs were reread during this phase: frozen install, generated bindings/strict types, both builds, **131 Vitest tests across 16 files and 12 Playwright checks passed**. This is GitHub-hosted Linux execution with local Cloudflare emulators and synthetic records, not deployed Cloudflare verification. The web journey includes the original 12 HTTP assertions; those are not 12 additional Vitest cases.

Current documentation work used read-only source/config/test inspection, baseline comparison and documentation validation. No local dependency install, app initialization/migration, typecheck, application test/build or deployment was run. PR checks, if triggered automatically on opening the documentation PR, are separate from this historical baseline and must be reported by their own SHA/run.

## Delivery state

| Capability | Implementation state | Verification boundary / remaining work |
| --- | --- | --- |
| Accounts | Implemented locally | Email/password, email verification, recovery, verified private owner access; auth mail is local capture |
| Owner supply | Implemented private draft subset | Property basics, room types, weekly USD prices/stock, information and private photos; [contract](features/owner-supply.md) |
| Booking foundation | Implemented API/database subset | Quotes, submission/detail, accept/decline/cancel/expiry, external allocation and inventory; [contract](features/bookings.md) |
| Arrival/completion | Blocked/incomplete | `check_in` rejects with decision-required; complete requires an already checked-in record; no complete stay lifecycle |
| Notifications | Implemented local substitute | Outbox, queues, lease fencing/backoff and capture; real sending/reminders/operations remain incomplete |
| Discovery/destinations | Planned | No public search/catalog/destination journey in active app |
| Guest and owner booking screens | Planned | Backend routes are not a complete booking/list/management UI |
| Publication/partner/admin/support | Planned | No general partner/contact submission, publication moderation or support dashboard |
| Other-category reservations/payments | Deferred | Accommodation-first, pay-at-property v1 remains accepted policy |
| Language/design | Partial | Khmer names/fonts and some labels; predominantly English working UI, not full Khmer localization |

Implementation-plan steps 1–5 and the later pnpm amendment are recorded as locally completed history. Step 6 remains partial owner-supply/product work. Historical next-step lists do not override this table.

## Environment scope

| Environment | Established evidence | Not established |
| --- | --- | --- |
| Local emulators / historical GitHub CI | Native workerd/D1, emulated R2/Images, actual built web/jobs Workers and Chromium desktop/phone emulation | Real providers, resource permissions/quotas/costs, HTTPS production sessions and full Images fidelity |
| Staging | No configured staged resources or staging validation established by this repository review | Live D1/Queues/Cron/R2/Images/email, failure recovery/load/restore |
| Production/pilot | No production readiness established | Deployment/account state, deliverability, operator readiness, recovery, performance and pilot usability |

Earlier Windows network/browser-override notes remain historical environment evidence; they do not invalidate the matching-browser CI pass or establish today's PC setup. External Cloudflare account/deployed traffic/secrets were not inspected.

## Approved documentation phase

The approved slice is canonical docs/status, archived historical content, concise root/package READMEs, root AGENTS and PR template, with branch commit/push/PR opening. No code, dependency, schema, deployment configuration or repository-protection change is included. No merge is authorized. Review the PR's validation evidence for this phase; recording this scope does not claim the PR has merged.

## Follow-ups requiring separate scope or decisions

| Priority | Follow-up | Boundary |
| --- | --- | --- |
| Before release | A01: transitive `glob@10.3.3` remains in [lockfile](../pnpm-lock.yaml), via OpenNext AWS / node-minify build chain | Audit reported [GHSA-5j98-mcp5-4vw2](https://github.com/isaacs/node-glob/security/advisories/GHSA-5j98-mcp5-4vw2); reachable CLI exploitation unknown; installed audit/remediation not executed here |
| Governance | A04: required verification/review policy and real reviewer assignment | Audit observed unprotected main/no rulesets; current settings not reread or changed; D18 approval needed |
| Before public exposure | A02/A03: provider/environment path and action/upload/storage abuse budgets | Preserve local fail-closed guards; D07/D08/D11 before nonlocal work |
| Policy/recovery | Arrival, publication/support, retention/erasure and recovery ownership | [Open decisions](product/open-decisions.md), especially D01/D05/D06/D09/D10 |
| Engineering proposals | Narrow imports/contracts, reusable mutation-attempt handling, durable guest attempt recovery | No source moves/helper extraction/boundary tooling in this phase |
| Pilot quality | Khmer copy, accessibility, slow-device/performance and real-service validation | No full accessibility, cross-engine/device or capacity certification |
| Small source follow-up | Diagnostics success status can differ from creation response; photo UI has a stray replacement character | Audit A11/A10; unchanged here; separate focused code/copy fix |

Next the project owner reviews this documentation PR and chooses a separately scoped follow-up. No next feature or unresolved business rule is approved by this status page.
