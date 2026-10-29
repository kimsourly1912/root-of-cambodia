# Proposed pilot publication checklist

**Status:** proposed; requires project-owner agreement before enforcement. No product policy is approved by this document.

**Responsible role:** project owner (decision); maintainer (implementation after approval).

**Last source verification:** 29 October 2026, merged main [d53544c](https://github.com/kimsourly1912/root-of-cambodia/commit/d53544cbee11def8e2522a33075235ba0abe73e0).

**Sources:** [accepted scope](scope.md), [D05/D15/D17](open-decisions.md), [publication contract](../features/publication-review.md), [snapshot reader](../../packages/backend/src/publication-queries.ts), [current review guidance](../../apps/web/components/review-snapshot.tsx).

## What needs deciding

The owner/reviewer/corrections/approval workflow is merged. It checks identity, ownership, saved snapshots, unfinished uploads and explicitly configured terms. Missing description/address/contact/rooms/rates/photos are currently reminders; even an otherwise bare draft can be approved when terms are configured. This is deliberate pending D05, not proof of a launch-ready listing.

Recommendation: approve a small minimum-content checklist before building public discovery. Keep private drafts flexible; enforce the approved checklist when submitting and again when approving. The checklist would establish basic listing completeness, not verify legal ownership, safety, service quality, availability or a right to operate.

## Recommended minimum

| Area | Proposed publication requirement | Reason / boundary |
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

## Implementation after agreement

Use the existing Next.js pages and shared backend; no new service, framework or storage product is needed. A shared readiness result should return missing-item codes to the owner and reviewer with links to the relevant setup tabs. Services enforce the approved rules; the atomic save must recheck the relevant saved values and calendar eligibility so direct API calls or stale pages cannot bypass them. Preserve immutable submission snapshots, version fencing, required history and same-key recovery. Review additive SQL changes only if needed for those commit-time checks; do not rewrite migration 0011.

Tests should cover each missing requirement, optional fields, inactive rooms, past dates, the exact 24-hour boundary, stale/revoked access, competing actions, rollback, receipt replay and existing publication/booking behavior. A fully reserved calendar remains a completeness success, but booking submission/acceptance must continue rejecting unavailable stock. Show the owner what to fix before submission; a missing item never silently publishes a listing.

Approving this proposal resolves only this D05 minimum checklist. It does not select the real reviewer account, approve/author booking terms, authorize deployment/public discovery, define published editing/pause rules or settle guest address/contact/arrival disclosure. D15/D17 and environment/abuse/recovery decisions remain separate.

## Decision record

Awaiting project-owner agreement with the recommended minimum or specified changes. Do not mark this accepted or implement mandatory gates until agreement is recorded in [open decisions](open-decisions.md).
