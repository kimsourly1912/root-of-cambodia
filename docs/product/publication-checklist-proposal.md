# Accepted pilot publication checklist

**Status:** accepted by the project owner on 29 October 2026; enforcement implemented on feat/publication-readiness, with verification tracked in status.

**Responsible role:** project owner (policy); maintainer (implementation).

**Last source verification:** 29 October 2026, implementation based on merged main [99e8350](https://github.com/kimsourly1912/root-of-cambodia/commit/99e8350afd1b0aeca035e8707d428d6865fdb8dc).

**Sources:** [accepted scope](scope.md), [D05/D15/D17](open-decisions.md), [publication contract](../features/publication-review.md), [snapshot reader](../../packages/backend/src/features/publication/publication-queries.ts), [current checklist](../../apps/web/features/publication/components/publication-checklist.tsx).

## Accepted decision and rationale

The owner approved the recommended minimum after reviewing PR #20 and the proposal, replying “Yes please continue and approve” on 29 October 2026. This resolves the minimum-content portion of D05 only. The previous release treated missing description/address/contact/rooms/rates/photos as reminders. This implementation makes them mandatory for new submission and approval commands, while preserving earlier receipts and immutable snapshots.

Keep private drafts flexible; enforce this checklist when submitting and again when approving. It establishes basic listing completeness, not legal ownership, safety, service quality, availability or a right to operate. Public discovery remains later scope.

## Approved minimum

| Area | Publication requirement | Reason / boundary |
| --- | --- | --- |
| Existing basics | Retain verified owner, owner display name, Khmer property name, province, valid check-in/check-out times and house rules | Already required for draft creation; English name remains optional |
| Description and address | Nonblank saved description and address | A guest needs to understand the stay and where it is; automated checks cannot verify accuracy |
| Contact | At least one saved contact phone or email | Informational property contact only; no phone verification or change to account email; do not disclose it publicly in this slice |
| Photos | At least one fully processed photo; recommend three useful photos during manual review | A one-photo minimum accommodates small properties; three is guidance, not a hidden hard requirement; no public cover/delivery decision |
| Rooms | At least one active room type with valid existing capacity settings | Prevent publication without any accommodation option; no new child/infant classification |
| Initial calendar | At least one active room has a dated USD rate and stock capacity greater than zero for a check-in at least 24 hours ahead at validation time | Confirms some initial setup without mandating 30/90 days; reserved/blocked counts must not unpublish an otherwise complete listing; real booking still checks all occupied nights, prices and free stock |
| Terms and reviewer | Retain explicitly configured approved booking terms and the sole reviewer's manual decision | A version identifier alone is not legal text or legal approval; synthetic test terms remain fixtures |

Keep facilities, map coordinates, contact-person name and arrival directions optional. They can be requested through correction notes when a particular property needs them. Do not add a map provider, photo-quality score, mandatory paid verification or automatic reviewer bypass.

The reviewer should check that photos and description reasonably match the accommodation, the address is understandable, contact details appear usable and house rules/charges are clear. Corrections use the existing attributable notes. This manual check must not be described as certification.

## Alternatives and tradeoffs

| Option | Effect |
| --- | --- |
| Keep manual reminders only | Least engineering; easy for one reviewer to miss incomplete listings and harder to apply a consistent standard |
| Recommended minimum plus manual review | Small implementation within the existing stack; repeatable minimum while retaining human judgment |
| Require three photos, coordinates and a fixed calendar horizon | More setup effort and greater exclusion of small/seasonal owners; map/location verification and commercial calendar policy need further decisions |

## Implementation contract

Use the existing Next.js pages and shared backend. The shared readiness result returns missing-item codes to the scoped owner/reviewer reads; owner drafts link to relevant setup tabs. Services enforce the rules and the atomic save repeats the same SQL predicates against current D1 time, so direct API calls and stale pages cannot bypass them. Preserve immutable submission snapshots, version fencing, required history and same-key recovery. The existing schema supports these guarded saves; no migration is added and migrations 0001–0011 remain unchanged. Existing pending reviews that are incomplete can be withdrawn/returned for correction, but a new approval must pass the checklist. Earlier successful receipts still replay after eligibility changes, and published records are not automatically unpublished.

Tests should cover each missing requirement, optional fields, inactive rooms, past dates, the exact 24-hour boundary, stale/revoked access, competing actions, rollback, receipt replay and existing publication/booking behavior. A fully reserved calendar remains a completeness success, but booking submission/acceptance must continue rejecting unavailable stock. Show the owner what to fix before submission; a missing item never silently publishes a listing.

This approval resolves only this D05 minimum checklist. It does not select the real reviewer account, approve/author booking terms, authorize deployment/public discovery, define published editing/pause rules or settle guest address/contact/arrival disclosure. D15/D17 and environment/abuse/recovery decisions remain separate.

## Decision record

Accepted on 29 October 2026 in the project conversation, following the proposal in PR #20. [Open decisions](open-decisions.md#minimum-publication-checklist--29-october-2026) records the approval and remaining boundaries. No merge or deployment of this new implementation is inferred from checklist approval.
