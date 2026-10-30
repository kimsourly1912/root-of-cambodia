# Open decisions

**Status:** unresolved; no options below are newly approved.

**Responsible role:** project owner (responsibility, not an assigned person).

**Last source verification:** 29 October 2026; guest-browsing implementation based on [ef971f1](https://github.com/kimsourly1912/root-of-cambodia/commit/ef971f1a863c6211a9a55fb1223982327fc5fdf7).

**Sources:** [docs/archive/2026-10/Root-of-Cambodia-Product-Plan.md](../archive/2026-10/Root-of-Cambodia-Product-Plan.md), [docs/archive/2026-10/Root-of-Cambodia-Build-Specification.md](../archive/2026-10/Root-of-Cambodia-Build-Specification.md), [docs/archive/2026-10/Root-of-Cambodia-Backend-Foundation-Review.md](../archive/2026-10/Root-of-Cambodia-Backend-Foundation-Review.md), [docs/archive/2026-10/Root-of-Cambodia-Property-Photos-Review.md](../archive/2026-10/Root-of-Cambodia-Property-Photos-Review.md).

This log preserves open policy and operational choices. Options describe decisions to make, not recommendations silently accepted through documentation cleanup. The project owner is the decision owner until a real delegate is assigned. Entries below remain **open** except the explicitly recorded D05 reviewer assignment, minimum checklist and first public-browsing boundary. Record an explicit outcome, approval evidence/date and affected canonical contract when resolved.

| ID | Decision / options to assess | Consequence / blocking feature |
| --- | --- | --- |
| D01 | [Selected normal stay flow](stay-operations.md): owner-attested arrival within the booked schedule and manual completion; early/late overrides, no-show and post-check-in cancellation remain open | Ordinary arrival/completion selected under delegated recommendations on 30 October 2026. Exceptions and a complete operational stay claim remain separate |
| D02 | Adult/child age definitions, infant treatment, party distribution and pilot request/stay limits | Aggregate capacity enforcement exists; does not settle classification, infants or commercial limits |
| D03 | Physical-unit assignment/continuity versus quantity-only inventory; validate with pilot owners | Nightly quantities cannot guarantee one particular physical room remains free throughout a stay |
| D04 | External reservation contact/guest fields, negotiated prices and consent evidence | Current owner-only catalog-priced anonymous allocation is narrower than a full external booking workflow |
| D05 | Additional-property review policy, high-impact edits, published/paused editing/re-consent and future public photo variants/caching | Sole pilot reviewer, [minimum checklist](publication-checklist-proposal.md) and [first browsing boundary](guest-browsing-proposal.md) accepted on 29 October 2026. Processed-only photos/first-photo cover and explicit owner acknowledgement are selected; broader editing/live-release policy remains open. Technical `unconfigured` terms are not publishable |
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
| D17 | [Accepted booking journey](booking-journey-proposal.md): confirmation-only logistics, acceptance-time immutable copy, owner preview/completeness guard, terminal-state hiding and legacy unavailable state | Accepted 30 October 2026; staged implementation. No public address endpoint or historical backfill. Later published corrections/retention/support remain D05/D09/D06 |
| D18 | Named maintainer/reviewer, required CI check, review and solo-maintainer emergency policy | Blocks CODEOWNERS and repository protection changes; no fictional reviewers assigned |

## Approval boundaries outside this phase

Documentation consolidation, root AGENTS, updated READMEs, archive preservation and a PR template were explicitly approved on 29 October 2026, including branch commit/push/PR creation. That approval excludes application/dependency/schema/config/settings changes, installs, local initialization/migrations, deployment and merging.

After the documentation PR merged, the owner authorized bounded A01 dependency triage, a compatible fix and relevant install/audit/compatibility checks on 29 October 2026; see [current evidence](../status.md). This does not approve unrelated upgrades or resolve the business decisions above. Protection work (D18) needs separate settings authorization. Existing stack, modular monolith, atomic booking direction and pnpm selection are already accepted; see [ADRs](../architecture/overview.md#decision-records). Proposed module moves and new boundary tooling remain separate work.

Online payment/deposit/refund and other-category reservations may be reopened only by an explicit scope decision. The [accepted scope](scope.md) continues to apply until then; these are not pending implementation tasks.

## Pilot reviewer decision — 29 October 2026

The project owner accepted the recommendation to act as sole pilot publication reviewer and authorized the next implementation slice after merging PRs #17/#18. This partially resolves D05 reviewer responsibility only. Configure an explicit verified app account through the trusted local command; no account ID or legal terms version was guessed. D05 required fields/first-property checklist and future publication rules, D06 support powers, D15 terms/privacy approval and D18 repository governance remain open. This is not a general admin assignment or deployment authorization.

The minimum-content portion was subsequently approved as recorded below; the reviewer assignment alone did not approve it.

## Minimum publication checklist — 29 October 2026

After the proposal in merged PR #20, the project owner replied “Yes please continue and approve,” accepting the [recommended minimum](publication-checklist-proposal.md): description/address, phone or email, at least one ready photo, an active room and a matching future USD rate/positive stock setup at least 24 hours before scheduled Cambodia check-in, alongside existing basics/identity/manual review/approved terms. Enforce on submission and approval; retain optional facilities/coordinates/arrival notes, existing price bounds and fully reserved/blocked listing completeness. This authorizes the focused implementation and verification, not actual legal text/version approval, inferred account assignment, guest disclosure, publication of a real property, merge/deployment, new providers or wider D05 policies.

## Guest browsing proposal — 29 October 2026

After PR #21 merged, the owner requested the next step. A [concrete browsing proposal](guest-browsing-proposal.md) recommends a read-only anonymous catalog/detail slice, a public/private field allowlist, processed-only gallery delivery with the first photo as cover, and explicit versioned owner authorization before public eligibility. At that stage the new D05/public-disclosure choices remained proposed; “Ok next” alone did not approve them. Subsequent acceptance is recorded below. D17 booking-state disclosure/snapshot timing, existing-published re-consent/editing and live release remain open. No private fields or media are exposed by this planning work.

## Public browsing decision — 29 October 2026

After the concrete field/media/owner-control proposal and an explicit agreement question, the project owner instructed “Merged and continue.” This accepts [the first browsing scope](guest-browsing-proposal.md): anonymous read-only list/detail, the public allowlist, province-only location, processed ready gallery photos/first-photo cover, private originals/logistics and versioned owner public-display acknowledgement tied to submitted content. It authorizes the focused local implementation/tests and completion of PR #22's merge after its passing CI. Earlier approvals are not retroactive public authorization. D17 Pending/Confirmed/later booking logistics and snapshot rules, published re-consent/editing/pause controls, legal terms and remote provisioning/migration/spend/deployment remain separate.

## Booking journey proposal — 30 October 2026

After PR #23 merged, the owner requested the next step. The [concrete proposal](booking-journey-proposal.md) recommends guest request/tracking and owner response in two local implementation slices. D17 would reveal property logistics only to the booking guest while Confirmed, using the exact copy previewed and saved at owner acceptance. It includes terminal-state hiding, acceptance completeness/revision guards and honest unavailable behavior for legacy bookings without a copy. These new choices remain **proposed**, not accepted by the continuation instruction or a planning PR merge. Existing price/terms snapshots, booking rules, privacy boundaries and open arrival/support/retention/release decisions remain unchanged.

## Guest booking decision — 30 October 2026

After the concrete proposal and privacy question, the owner replied “Ok” and expressly authorized finishing guest screens then starting owner responses, accepting the recommendations for this work. [Approval record](booking-journey-proposal.md#approval-record-and-next-action) resolves D17 for the stated matrix/copy/safeguards and authorizes local slices A/B. It is not inferred from a merge. Actual approved legal text, arrival/age/infant/support/corrections/retention/live release decisions remain separate. The accepted implementation uses account-bound server-saved reviews with opaque recovery IDs, immutable terms documents and existing atomic booking operations; no private request payload is persisted in browser storage.

## Two stay-operation steps — 30 October 2026

The owner delegated decisions to the stated recommendations and requested merging PRs #24–#26 and starting two more steps. The [selected local scope](stay-operations.md) records the exact schedule window, manual departure/completion, preserved stock/price and full-payment attestation/correction rules, alternatives and open exceptions. D01 is only partially resolved; no-show, overrides, late cancellation, infant/age, privileged support, actual legal/provider/retention and release policies are not invented. This is delegated implementation authority, not a claim of separate literal approval of each rule or permission to deploy/spend.

## Owner listing-control agreement — 30 October 2026

The project owner explicitly agreed to the [two-stage proposal](published-listing-controls-proposal.md), replying “ok agree you can start all of them” after its recommendation/alternatives and agreement question. D05 is partially resolved for A owner-attributed unchanged-approval pause/resume, and B offline correction with fresh public acknowledgement/manual review, in that order. No silent update to Confirmed guests' saved logistics or notification is approved. [ADR 0007](../architecture/decisions/0007-owner-listing-controls.md) records the implementation boundary.

The broader D05 additional-property/exemption/cache policy, unknown/moderation pause recovery, privileged support, actual terms, retention/live-service/release decisions remain open. This authorizes implementation and checks for both stages; it does not authorize merging the planning or code PRs, deployment, remote migration or spending.
