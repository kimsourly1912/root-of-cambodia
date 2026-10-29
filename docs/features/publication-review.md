# Pilot publication review

**Status:** implemented local pilot workflow; public launch is not established.

**Responsible role:** project owner, the sole pilot publication reviewer. Trusted local operator provisions the explicit application account; no account is inferred from GitHub or signup order.

**Last source verification:** 29 October 2026; publication candidate based on merged main [484989d](https://github.com/kimsourly1912/root-of-cambodia/commit/484989df749689f797aa125ccf590e7eba0b0cb6).

**Sources:** [services](../../packages/backend/src/publication.ts), [scoped reads](../../packages/backend/src/publication-queries.ts), [atomic persistence](../../packages/backend/src/publication-persistence.ts), [migration 0011](../../packages/backend/migrations/0011_property_publication_review.sql), [native regressions](../../tests/publication.test.ts), [browser journey](../../tests/browser/owner.spec.ts).

## Approved scope and remaining decisions

On 29 October 2026 the project owner accepted the recommendation to act as sole pilot publication reviewer and authorized starting this next slice after merging PRs #17/#18. This assigns a narrow listing-review responsibility, not general support, booking impersonation, staff administration or repository protection powers. The selected application account still needs explicit local provisioning.

Owners submit saved private drafts, withdraw pending submissions to edit, receive correction notes and resubmit. The configured reviewer reads a private oldest-first queue, returns required correction notes or approves publication against an explicitly configured approved booking-terms version. No first-user privilege grant or web role-management endpoint exists.

The required-fields checklist, additional-property fast tracks, high-impact published edits, pause/resume, public discovery/photo variants and guest contact disclosure remain [D05/D17](../product/open-decisions.md). Description/address/contact/active rooms/prices/photos are visible preparation guidance, not an invented mandatory-field policy. Every submission exposed by this workflow is reviewed manually; it does not introduce an automatic approval path. Draft editing remains unavailable while review is pending or after publication. D06 broader admin/support powers and D15 legal/privacy text remain open.

## Local provisioning and terms gate

After local initialization and registration/email verification, a trusted operator uses [reviewer:local](../development/setup.md#local-pilot-reviewer) with the deliberately selected app user ID. The singleton configuration permits exactly one reviewer. A verified ordinary owner cannot grant themselves review access through any product route. Configuration is local only and does not provision a live operator.

Initial configuration has no terms version. Owners may submit and receive corrections, but approval fails with publication_terms_not_configured until approved booking terms are selected explicitly. The setup command accepts an approved version identifier; it neither authors nor approves legal text. Synthetic test terms are fixtures only. Never use unconfigured or treat a test version as public-pilot approval. Omission preserves an existing configured version; --clear-terms revokes it. Reassignment/terms changes increment a config revision and fence in-flight decisions.

## State, snapshot and atomicity

| Action | Required actor/state | Result |
| --- | --- | --- |
| submit | Current verified property owner; draft; current property revision; verified reviewer configured; no unfinished gallery uploads | place becomes review; immutable pending request and submitted snapshot |
| withdraw | Current verified submitting owner; pending request and expected request revision | Request withdrawn; place returns to draft |
| return_changes | Current configured verified reviewer; pending request and expected revision; nonempty correction reason | Request returned; place returns to draft; owner sees reason |
| approve | Current configured verified reviewer; pending/expected revision; current verified owner; unchanged submitted snapshot; same config revision and approved terms | Request approved; place published; property terms version set explicitly |

Submission snapshots saved basics, owner display name, booking settings/charges, information, location/contact/arrival fields, room settings and price-range/configured-night summaries, calendar edit counters, gallery order and ready-photo identities/dimensions. It is not a guest booking quote, full dated calendar export or physical-unit guarantee. Reservation counters are excluded; booking-time price/stock coverage remains authoritative. One deterministic SQL read is compared again inside submission and approval batches. Existing draft-only writes cannot edit a pending review. Pending uploads must finish or be removed first; otherwise the draft lock would prevent their completion. Engineering snapshot bounds are 100 room types and 256 KiB serialized data, not commercial listing limits.

Each command, state change, required attributable event and sealed success receipt shares one D1 batch. A zero-row stale/unauthorized transition cannot leave a successful receipt or partial publication. Required history failure rolls back the whole batch. Request snapshots, terminal requests, events and sealed receipts are retained/immutable. No new notification provider/outbox promise or destructive retention process is introduced.

Review commands use their own owner/reviewer receipt table and actor/key namespace. The existing booking operation schema only permits guest/owner/system roles; it is preserved rather than mislabelling a reviewer or rebuilding existing booking history. As with other operations, a reused review key with a different role/action/payload conflicts. This separate namespace does not change any older endpoint's key contract.

## Access and HTTP contract

All JSON routes use the existing verified session, Origin/JSON write checks, 32 KiB streamed body cap and private/no-store + Vary: Cookie adapter. Mutations require Idempotency-Key. Inputs reject unknown policy/role/state fields. Expected revisions are positive safe integers; correction notes are trimmed, at most 2,000 characters and reject unsupported controls. Approval notes are optional.

| Route | Methods and input | Authorized result |
| --- | --- | --- |
| /api/owner/properties/:id/review | GET; POST action=submit/propertyRevision or action=withdraw/requestId/revision | Current owned publication state, saved draft/latest submission/correction timeline and readiness flags; POST 200 id/status receipt |
| /api/property-reviews | GET optional numeric cursor | Configured reviewer only; at most 20 pending requests, oldest first; nextCursor or null |
| /api/property-reviews/:id | GET; POST action=return_changes or approve/revision/optional reason | Reviewer only; pending immutable snapshot/timeline and configured terms version; POST 200 id/status receipt |
| /api/property-reviews/:id/photos/:photoId | GET | Submitting current owner or configured reviewer; pending snapshot member and ready media only; processed JPEG |

Unconfigured/unassigned reviewers receive not_found; verification still requires a verified session. Definite conflicts return review_conflict (409), invalid inputs invalid_review (422), missing reviewer reviewer_not_configured (422), unfinished gallery uploads unfinished_photos (422). Technical snapshot bounds use request_size_limit (422). Existing 401/403/404/413/503 handling remains. Private original objects, storage keys/hashes, guest records and role-management are never returned.

Preview authorization is checked before and after storage access, uses private/no-store, Cookie variation and nosniff, and reads only the existing processed metadata-stripped preview. Withdrawal, terminal status, ownership transfer or reviewer revocation ends review-preview access. Downloaded bytes cannot be recalled. Public photo delivery remains undecided.

## Screens, retries and verification

The owner Publication review tab shows saved details and latest submission notes. Reviewer /review and /review/:id pages are private/noindex, with bounded pagination and read-only submitted details. Only the selected verified reviewer sees the review-queue link in their owner workspace. Completeness reminders require human judgment; they are not proof of readiness.

Uncertain requests keep the same key and frozen payload in the open tab, expose Retry same action and do not create a fresh attempt automatically. Confirmed success refreshes current authorized state; definite stale conflicts require reloading latest status. Tab-close durable recovery remains outside this slice. A recovered receipt retains the original operation result, even after later workflow transitions; current access is still required.

Native tests cover permissions, immutable snapshots/history, missing terms, concurrency, response loss, submission/approval revocation and snapshot races, photo privacy, unchanged booking data and fresh/populated upgrades. Built-Worker HTTP tests exercise real sessions, Origin refusals, safe private JSON/media errors and absence of the fixture-provisioning path. The browser test process alone has an explicit synthetic reviewer provisioner, never imported by the Worker; desktop/phone journeys exercise submit/withdraw/retry/return/resubmit/approve. [Status](../status.md) owns observed results and environment limits; implementation is not a deployment or public-pilot acceptance.
