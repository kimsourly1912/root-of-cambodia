# Pilot publication review

**Status:** implemented local pilot workflow; public launch is not established.

**Responsible role:** project owner, the sole pilot publication reviewer. Trusted local operator provisions the explicit application account; no account is inferred from GitHub or signup order.

**Last source verification:** 29 October 2026; checklist implementation based on merged main [99e8350](https://github.com/kimsourly1912/root-of-cambodia/commit/99e8350afd1b0aeca035e8707d428d6865fdb8dc).

**Sources:** [shared readiness predicates/read](../../packages/backend/src/publication-readiness.ts), [checklist regressions](../../tests/publication-readiness.test.ts), [services](../../packages/backend/src/publication.ts), [scoped reads](../../packages/backend/src/publication-queries.ts), [atomic persistence](../../packages/backend/src/publication-persistence.ts), [migration 0011](../../packages/backend/migrations/0011_property_publication_review.sql), [native regressions](../../tests/publication.test.ts), [browser journey](../../tests/browser/owner.spec.ts).

## Approved scope and remaining decisions

On 29 October 2026 the project owner accepted the recommendation to act as sole pilot publication reviewer and authorized starting this next slice after merging PRs #17/#18. This assigns a narrow listing-review responsibility, not general support, booking impersonation, staff administration or repository protection powers. The selected application account still needs explicit local provisioning.

Owners submit saved private drafts, withdraw pending submissions to edit, receive correction notes and resubmit. The configured reviewer reads a private oldest-first queue, returns required correction notes or approves publication against an explicitly configured approved booking-terms version. No first-user privilege grant or web role-management endpoint exists.

The project owner approved the [minimum publication checklist](../product/publication-checklist-proposal.md) on 29 October 2026, replying “Yes please continue and approve” after PR #20. Description/address, a phone or email, at least one ready photo, an active room and initial future rate/positive stock setup are now required for new submission and approval commands. Existing basics/identity/manual review/terms requirements remain. Additional-property fast tracks, high-impact published edits, pause/resume, public discovery/photo variants and guest contact disclosure remain [D05/D17](../product/open-decisions.md). Every submission exposed by this workflow is reviewed manually; it does not introduce an automatic approval path. Draft editing remains unavailable while review is pending or after publication. D06 broader admin/support powers and D15 legal/privacy text remain open.

## Minimum checklist and time boundary

[publication-readiness.ts](../../packages/backend/src/publication-readiness.ts) owns one set of SQL predicates for the scoped guidance read, service refusal and named atomic submit/approval saves. Content checks are basics, description, address, contact, photos, uploads, rooms and calendar. A result contains ready, missing item codes and boolean checks; it is distinct from reviewer/terms configuration. Blank/incomplete private drafts still save normally.

The calendar requirement is one active room with a matching nightly USD rate and inventory row of capacity greater than zero whose scheduled Cambodia check-in is at least 24 hours ahead at validation time. It uses D1 unixepoch(), the property's saved check-in time and UTC+7, includes equality and is repeated inside the write batch. No 30/90-day horizon or new minimum price is imposed. Rates on another room/property or date, past nights, zero capacity and inactive rooms do not qualify. Reserved and blocked quantities do not affect completeness; booking-time full-stay coverage and actual free-stock checks remain authoritative.

At least one ready gallery member is required, and no unfinished upload may remain. Three useful photos are guidance only. English name, facilities, coordinates, contact-person name and arrival directions stay optional. Contact details remain informational/private; no phone verification or public disclosure is introduced.

No migration is needed: earlier tables, receipts, snapshots and migrations 0001–0011 are unchanged. Earlier incomplete pending requests stay readable and can be withdrawn/returned for correction; new approval requires the current checklist. Eligibility can age out while awaiting review; return the request for calendar updates. Successful historical/same-attempt receipts replay before new readiness checks, with current access still required. Existing published listings are not automatically unpublished as dates pass or stock fills.

## Local provisioning and terms gate

After local initialization and registration/email verification, a trusted operator uses [reviewer:local](../development/setup.md#local-pilot-reviewer) with the deliberately selected app user ID. The singleton configuration permits exactly one reviewer. A verified ordinary owner cannot grant themselves review access through any product route. Configuration is local only and does not provision a live operator.

Initial configuration has no terms version. Owners may submit and receive corrections, but approval fails with publication_terms_not_configured until approved booking terms are selected explicitly. The setup command accepts an approved version identifier; it neither authors nor approves legal text. Synthetic test terms are fixtures only. Never use unconfigured or treat a test version as public-pilot approval. Omission preserves an existing configured version; --clear-terms revokes it. Reassignment/terms changes increment a config revision and fence in-flight decisions.

## State, snapshot and atomicity

| Action | Required actor/state | Result |
| --- | --- | --- |
| submit | Current verified property owner; draft; current property revision; verified reviewer configured; complete minimum checklist and no unfinished gallery uploads | place becomes review; immutable pending request and submitted snapshot |
| withdraw | Current verified submitting owner; pending request and expected request revision | Request withdrawn; place returns to draft |
| return_changes | Current configured verified reviewer; pending request and expected revision; nonempty correction reason | Request returned; place returns to draft; owner sees reason |
| approve | Current configured verified reviewer; pending/expected revision; current verified owner; unchanged submitted snapshot; same config revision and approved terms; current checklist including the 24-hour calendar boundary | Request approved; place published; property terms version set explicitly |

Submission snapshots saved basics, owner display name, booking settings/charges, information, location/contact/arrival fields, room settings and price-range/configured-night summaries, calendar edit counters, gallery order and ready-photo identities/dimensions. It is not a guest booking quote, full dated calendar export or physical-unit guarantee. Reservation counters are excluded; booking-time price/stock coverage remains authoritative. One deterministic SQL read is compared again inside submission and approval batches. Existing draft-only writes cannot edit a pending review. Pending uploads must finish or be removed first; otherwise the draft lock would prevent their completion. Engineering snapshot bounds are 100 room types and 256 KiB serialized data, not commercial listing limits.

Each command, state change, required attributable event and sealed success receipt shares one D1 batch. A zero-row stale/unauthorized transition cannot leave a successful receipt or partial publication. Required history failure rolls back the whole batch. Request snapshots, terminal requests, events and sealed receipts are retained/immutable. No new notification provider/outbox promise or destructive retention process is introduced.

Review commands use their own owner/reviewer receipt table and actor/key namespace. The existing booking operation schema only permits guest/owner/system roles; it is preserved rather than mislabelling a reviewer or rebuilding existing booking history. As with other operations, a reused review key with a different role/action/payload conflicts. This separate namespace does not change any older endpoint's key contract.

## Access and HTTP contract

All JSON routes use the existing verified session, Origin/JSON write checks, 32 KiB streamed body cap and private/no-store + Vary: Cookie adapter. Mutations require Idempotency-Key. Inputs reject unknown policy/role/state fields. Expected request/configuration revisions are positive safe integers; stale reviewer pages cannot silently approve a newly selected terms version; correction notes are trimmed, at most 2,000 characters and reject unsupported controls. Approval notes are optional.

| Route | Methods and input | Authorized result |
| --- | --- | --- |
| /api/owner/properties/:id/review | GET; POST action=submit/propertyRevision or action=withdraw/requestId/revision | Current owned publication state, saved draft/latest submission/correction timeline and content readiness (ready/missing/checks) plus reviewer/terms flags; POST 200 id/status receipt |
| /api/property-reviews | GET optional numeric cursor | Configured reviewer only; at most 20 pending requests, oldest first; nextCursor or null |
| /api/property-reviews/:id | GET; POST action=return_changes or approve/revision/configRevision/optional reason | Reviewer only; pending immutable snapshot/timeline, current content readiness and configured terms version; POST 200 id/status receipt |
| /api/property-reviews/:id/photos/:photoId | GET | Submitting current owner or configured reviewer; pending snapshot member and ready media only; processed JPEG |

Unconfigured/unassigned reviewers receive not_found; verification still requires a verified session. Definite conflicts return review_conflict (409), invalid inputs invalid_review (422), missing reviewer reviewer_not_configured (422), unfinished gallery uploads unfinished_photos (422), incomplete content publication_incomplete (422). If readiness changes after preparation but before commit, the batch refuses atomically with review_conflict (409). Technical snapshot bounds use request_size_limit (422). Existing 401/403/404/413/503 handling remains. Private original objects, storage keys/hashes, guest records and role-management are never returned.

Preview authorization is checked before and after storage access, uses private/no-store, Cookie variation and nosniff, and reads only the existing processed metadata-stripped preview. Withdrawal, terminal status, ownership transfer or reviewer revocation ends review-preview access. Downloaded bytes cannot be recalled. Public photo delivery remains undecided.

## Screens, retries and verification

The owner Publication review tab shows saved details and latest submission notes. Reviewer /review and /review/:id pages are private/noindex, with bounded pagination and read-only submitted details. Only the selected verified reviewer sees the review-queue link in their owner workspace. Both views show the shared Publication checklist. Owner drafts link missing items to setup tabs; pending owner and reviewer views do not offer editing links. Submission/approval is disabled when incomplete, but the server remains authoritative. A stale incomplete response requires reload to show the current checklist. The reviewer still assesses accuracy/quality manually; content completeness is not certification.

Uncertain requests keep the same key and frozen payload in the open tab, expose Retry same action and do not create a fresh attempt automatically. Confirmed success refreshes current authorized state; definite stale conflicts require reloading latest status. Tab-close durable recovery remains outside this slice. A recovered receipt retains the original operation result, even after later workflow transitions; current access is still required.

Native tests cover each missing minimum, optional fields, exact Cambodia/leap-day/midnight deadlines, time/capacity changes between read and commit, direct persistence bypass refusal, retained legacy pending/receipts, full/blocked stock, and existing permissions, immutable snapshots/history, missing terms, concurrency, response loss, submission/approval revocation and snapshot races, photo privacy, unchanged booking data and fresh/populated upgrades. Built-Worker HTTP tests exercise real sessions, Origin refusals, safe private JSON/media errors and absence of the fixture-provisioning path. The browser test process alone has an explicit synthetic reviewer provisioner, never imported by the Worker; desktop/phone journeys exercise submit/withdraw/retry/return/resubmit/approve. [Status](../status.md) owns observed results and environment limits; implementation is not a deployment or public-pilot acceptance.
