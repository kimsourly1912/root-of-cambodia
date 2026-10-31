# ADR 0005: Explicit public listing projection and routed processed media

**Status:** accepted; implementation on feat/guest-browsing.

**Responsible role:** project owner (disclosure policy); maintainer (implementation).

**Last source verification:** 29 October 2026; based on merged main [ef971f1](https://github.com/kimsourly1912/root-of-cambodia/commit/ef971f1a863c6211a9a55fb1223982327fc5fdf7).

**Sources:** [accepted browsing scope](../../product/guest-browsing-proposal.md), [public model](../../../packages/backend/src/features/publication/public-listing.ts), [scoped public reads](../../../packages/backend/src/features/catalog/catalog-queries.ts), [disclosure migration](../../../packages/backend/migrations/0012_public_listing_disclosure.sql), [private media ADR](0004-private-media-lifecycle.md).

**Approval provenance:** after the explicit browsing/public-private proposal and request for agreement, the project owner instructed “Merged and continue” on 29 October 2026. This authorizes the stated field split, first-photo cover, routed processed-only photos, explicit owner acknowledgement and local implementation. It is not inferred solely from a merged PR. PR #22 was still open with passing CI when inspected; the authorized merge was completed at ef971f1 before starting this branch. No deployment/spend, real legal terms or D17 booking disclosure is approved.

## Context and decision

The private review snapshot includes owner identity, address/contact/arrival information and operational calendar summaries. Published status alone did not authorize public photo delivery. Never pass that snapshot to anonymous pages or client components.

Use an explicit public projection of the immutable approved submission. SQL selects the allowlisted source fields; a typed mapper constructs fresh public objects and the same mapper drives owner/reviewer preview. A display-policy version and SHA-256 digest bind acknowledgement to the exact public values and ordered ready-photo identities. The digest is an integrity binding, not a bearer credential or legal identity proof.

Migration 0012 adds immutable owner-attributed display evidence to each new submission. Evidence, submission/state, required history and sealed receipt share the existing atomic D1 save. The service checks the displayed digest; write-time guards compare the complete saved snapshot. New submit receipts cannot seal without evidence, and new approvals require it. Successful earlier receipts still replay before new requirements; no consent/history backfill is performed.

Anonymous reads require the latest submission to be approved, the property currently published, its current verified owner to match that submission/evidence and property terms to match the approved terms. They recompute the public digest and fail closed on mismatch. Current reviewer assignment and calendar completeness are not publication revocation rules. A later change to the public field set must use deliberate policy/version and transition work; silently exposing new fields would also invalidate existing hashes.

Keep R2 private. Serve only ready, approved gallery members' existing metadata-stripped JPEG previews through read-only web adapters. Check eligible state/ownership/membership before and after storage access and fence a changed approved request. Never expose originals, object keys, storage credentials or private review data. Publicly downloaded bytes cannot be recalled.

Start dynamic/no-store, with no shared catalog/media cache. Preserve the existing local-only runtime/provider guard. This is still one shared backend and the existing web Worker, not a new service or public bucket.

## Alternatives and consequences

| Choice | Consequence |
| --- | --- |
| Explicit projection and versioned owner acknowledgement | Additional preview/history and migration work; private values are excluded by construction and earlier uploads do not silently become public |
| Serialize the private snapshot or treat all earlier approval as disclosure | Less initial code; unacceptable risk of exposing private fields or changing earlier upload expectations |
| Routed processed media with no-store | Simple current-state refusal and reuse of existing processing; more Worker/D1/R2 reads, requiring real-service usage/performance budgets before launch |
| Public bucket/CDN with shared caching | Potential read/latency savings; needs a separately approved infrastructure, invalidation and revocation design |

Earlier approved records without acknowledgement are absent from browsing. Earlier pending submissions can be withdrawn/returned and resubmitted with confirmation; published re-consent/editing remains separate scope. A code rollback to pre-0012 cannot create new submissions under the new seal guard; retain the privacy guard and coordinate compatible code/migration rollout rather than deleting history. Existing booking operations are unchanged.

## Remaining boundaries

D17 guest booking-state disclosure/snapshot timing, broader D05 published editing/pause/re-consent, D07/D08 providers/resources, D09/D10 retention/recovery and D11 abuse budgets remain open. No public-pilot readiness, map provider, booking UI, quality certification or legal/privacy text follows from this ADR. ADR 0004 continues to govern private uploads/originals; this is its accepted processed-public-read extension.
