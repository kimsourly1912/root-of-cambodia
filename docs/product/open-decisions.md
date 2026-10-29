# Open decisions

**Status:** unresolved; no options below are newly approved.

**Responsible role:** project owner (responsibility, not an assigned person).

**Last source verification:** 29 October 2026, [607a705](https://github.com/kimsourly1912/root-of-cambodia/commit/607a7057b908a005f9f3529141b0978f52d24ce0).

**Sources:** [docs/archive/2026-10/Root-of-Cambodia-Product-Plan.md](../archive/2026-10/Root-of-Cambodia-Product-Plan.md), [docs/archive/2026-10/Root-of-Cambodia-Build-Specification.md](../archive/2026-10/Root-of-Cambodia-Build-Specification.md), [docs/archive/2026-10/Root-of-Cambodia-Backend-Foundation-Review.md](../archive/2026-10/Root-of-Cambodia-Backend-Foundation-Review.md), [docs/archive/2026-10/Root-of-Cambodia-Property-Photos-Review.md](../archive/2026-10/Root-of-Cambodia-Property-Photos-Review.md).

This log preserves open policy and operational choices. Options describe decisions to make, not recommendations silently accepted through documentation cleanup. The project owner is the decision owner until a real delegate is assigned. Entries below remain **open** except the explicitly recorded partial D05 reviewer assignment. Record an explicit outcome, approval evidence/date and affected canonical contract when resolved.

| ID | Decision / options to assess | Consequence / blocking feature |
| --- | --- | --- |
| D01 | Arrival eligibility/time cutoff, early/late arrival, no-show, manual exceptions and post-check-in owner/guest cancellation | Blocks check-in, no-show, arrival UI and a complete request-to-stay claim; keep `arrival_policy_decision_required` |
| D02 | Adult/child age definitions, infant treatment, party distribution and pilot request/stay limits | Aggregate capacity enforcement exists; does not settle classification, infants or commercial limits |
| D03 | Physical-unit assignment/continuity versus quantity-only inventory; validate with pilot owners | Nightly quantities cannot guarantee one particular physical room remains free throughout a stay |
| D04 | External reservation contact/guest fields, negotiated prices and consent evidence | Current owner-only catalog-priced anonymous allocation is narrower than a full external booking workflow |
| D05 | Additional-property review, first-property checklist, required publication fields, high-impact edits, published/paused editing and public photo/cover variants | Sole pilot reviewer assigned to the project owner on 29 October 2026; [narrow manual workflow](../features/publication-review.md) implemented. Required fields, further editing rules and public discovery remain open; technical `unconfigured` terms are not publishable |
| D06 | Audited support/admin powers, stronger admin authentication, escalation and suspended-owner handling | Blocks privileged support/suspension workflows; upcoming stays must remain resolvable without implicit impersonation |
| D07 | Sending provider/domain, account/budget ownership, auth-mail prompt delivery/recovery, email-change policy, resend/abuse controls and reminder timing/templates | Blocks nonlocal auth and real notifications; assess quotas, cost, provider idempotency and bounce/complaint evidence |
| D08 | Local/staging/production resource owners, pilot audience/properties, spend cap and operator | Blocks resource provisioning, nonlocal verification and deployment |
| D09 | Private-original/pending-upload/tombstone/history/account/operation-receipt retention, erasure/access and late-write fencing | Blocks destructive cleanup and production data collection; current recurring removal sweep is not a retention policy |
| D10 | Retry/dead-letter ownership, alert thresholds, recovery objectives (RPO/RTO), retained exports and D1/R2 restore procedure | Blocks operational acceptance and recovery claims; rollback alone cannot restore data or media |
| D11 | Per-account/action/upload byte and aggregate storage budgets; public error/limit responses and legitimate replay accounting | Blocks public registration/upload/business-action exposure; existing per-request/gallery bounds are insufficient |
| D12 | Map provider/geocoding/search and geographic data ownership, terms/budget, unavailable-permission fallback | Blocks live map/location features; address text is currently unverified |
| D13 | Pilot Khmer-first coverage, English support, translation/design review responsibility, accessibility/performance acceptance | Blocks finalized copy/usability claims; bundled Khmer fonts do not establish localization |
| D14 | Who creates, claims, reviews and maintains informational non-accommodation listings | Blocks discovery content operations; reservations remain deferred |
| D15 | Privacy/platform terms, support contacts, reports/moderation procedures and property responsibilities | Blocks public pilot approval; technical schemas do not settle business/legal policy |
| D16 | Future revenue model, optional Riel conversion and pilot success targets | Pilot remains free and USD/pay-at-property; no new commission or conversion rule |
| D17 | Current versus snapshotted address/contact/arrival disclosure in future guest booking details | Blocks guest disclosure contract; no public address endpoint is inferred from private information setup |
| D18 | Named maintainer/reviewer, required CI check, review and solo-maintainer emergency policy | Blocks CODEOWNERS and repository protection changes; no fictional reviewers assigned |

## Approval boundaries outside this phase

Documentation consolidation, root AGENTS, updated READMEs, archive preservation and a PR template were explicitly approved on 29 October 2026, including branch commit/push/PR creation. That approval excludes application/dependency/schema/config/settings changes, installs, local initialization/migrations, deployment and merging.

After the documentation PR merged, the owner authorized bounded A01 dependency triage, a compatible fix and relevant install/audit/compatibility checks on 29 October 2026; see [current evidence](../status.md). This does not approve unrelated upgrades or resolve the business decisions above. Protection work (D18) needs separate settings authorization. Existing stack, modular monolith, atomic booking direction and pnpm selection are already accepted; see [ADRs](../architecture/overview.md#decision-records). Proposed module moves and new boundary tooling remain separate work.

Online payment/deposit/refund and other-category reservations may be reopened only by an explicit scope decision. The [accepted scope](scope.md) continues to apply until then; these are not pending implementation tasks.

## Pilot reviewer decision — 29 October 2026

The project owner accepted the recommendation to act as sole pilot publication reviewer and authorized the next implementation slice after merging PRs #17/#18. This partially resolves D05 reviewer responsibility only. Configure an explicit verified app account through the trusted local command; no account ID or legal terms version was guessed. D05 required fields/first-property checklist and future publication rules, D06 support powers, D15 terms/privacy approval and D18 repository governance remain open. This is not a general admin assignment or deployment authorization.

Following the merge of PR #19, a [concrete minimum-checklist proposal](publication-checklist-proposal.md) is prepared for the project owner's agreement. It remains proposed and does not turn current preparation reminders into mandatory product rules.
