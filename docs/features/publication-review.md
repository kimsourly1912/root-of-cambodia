# Pilot publication review

**Status:** implemented local pilot workflow; public launch is not established.

**Responsible role:** project owner, the sole pilot publication reviewer. Trusted local operator provisions the explicit application account; no account is inferred from GitHub or signup order.

**Last source verification:** 29 October 2026; guest-browsing implementation based on [ef971f1](https://github.com/kimsourly1912/root-of-cambodia/commit/ef971f1a863c6211a9a55fb1223982327fc5fdf7).

**Sources:** [shared readiness predicates/read](../../packages/backend/src/publication-readiness.ts), [checklist regressions](../../tests/publication-readiness.test.ts), [services](../../packages/backend/src/publication.ts), [scoped reads](../../packages/backend/src/publication-queries.ts), [atomic persistence](../../packages/backend/src/publication-persistence.ts), [migration 0011](../../packages/backend/migrations/0011_property_publication_review.sql), [native regressions](../../tests/publication.test.ts), [browser journey](../../tests/browser/owner.spec.ts).

## Approved scope and remaining decisions

On 29 October 2026 the project owner accepted the recommendation to act as sole pilot publication reviewer and authorized starting this next slice after merging PRs #17/#18. This assigns a narrow listing-review responsibility, not general support, booking impersonation, staff administration or repository protection powers. The selected application account still needs explicit local provisioning.

Owners submit saved private drafts, withdraw pending submissions to edit, receive correction notes and resubmit. The configured reviewer reads a private oldest-first queue, returns required correction notes or approves publication against an explicitly configured approved booking-terms version. No first-user privilege grant or web role-management endpoint exists.

The project owner approved the [minimum publication checklist](../product/publication-checklist-proposal.md) on 29 October 2026, replying “Yes please continue and approve” after PR #20. Description/address, a phone or email, at least one ready photo, an active room and initial future rate/positive stock setup are now required for new submission and approval commands. Existing basics/identity/manual review/terms requirements remain. Additional-property fast tracks, high-impact published edits, pause/resume, future photo variants/caching and guest booking contact disclosure remain [D05/D17](../product/open-decisions.md). The subsequently accepted [guest-browsing boundary](guest-browsing.md) adds explicit public-display acknowledgement and a guest preview for new submissions/approvals. Every submission exposed by this workflow is reviewed manually; it does not introduce an automatic approval path. Draft editing remains unavailable while review is pending or after publication. D06 broader admin/support powers and D15 legal/privacy text remain open.

## Minimum checklist and time boundary

[publication-readiness.ts](../../packages/backend/src/publication-readiness.ts) owns one set of SQL predicates for the scoped guidance read, service refusal and named atomic submit/approval saves. Content checks are basics, description, address, contact, photos, uploads, rooms and calendar. Blank-text checks match existing JavaScript input trimming, including tabs, line breaks and Unicode spaces in earlier stored values. A result contains ready, missing item codes and boolean checks; it is distinct from reviewer/terms configuration. Blank/incomplete private drafts still save normally.

The calendar requirement is one active room with a matching nightly USD rate and inventory row of capacity greater than zero whose scheduled Cambodia check-in is at least 24 hours ahead at validation time. It uses D1 unixepoch(), the property's saved check-in time and UTC+7, includes equality and is repeated inside the write batch. No 30/90-day horizon or new minimum price is imposed. Rates on another room/property or date, past nights, zero capacity and inactive rooms do not qualify. Reserved and blocked quantities do not affect completeness; booking-time full-stay coverage and actual free-stock checks remain authoritative.

At least one ready gallery member is required, and no unfinished upload may remain. Three useful photos are guidance only. English name, facilities, coordinates, contact-person name and arrival directions stay optional. Contact details remain informational/private; no phone verification or public disclosure is introduced.

No migration is needed: earlier tables, receipts, snapshots and migrations 0001–0011 are unchanged. Earlier incomplete pending requests stay readable and can be withdrawn/returned for correction; new approval requires the current checklist. Eligibility can age out while awaiting review; return the request for calendar updates. Successful historical/same-attempt receipts replay before new readiness checks, with current access still required. Existing published listings are not automatically unpublished as dates pass or stock fills.

## Local provisioning and terms gate

After local initialization and registration/email verification, a trusted operator uses [reviewer:local](../development/setup.md#local-pilot-reviewer) with the deliberately selected app user ID. The singleton configuration permits exactly one reviewer. A verified ordinary owner cannot grant themselves review access through any product route. Configuration is local only and does not provision a live operator.

Initial configuration has no terms version. Owners may submit and receive corrections, but approval fails with publication_terms_not_configured until approved booking terms are selected explicitly. The setup command accepts an approved version identifier; it neither authors nor approves legal text. Synthetic test terms are fixtures only. Never use unconfigured or treat a test version as public-pilot approval. Omission preserves an existing configured version; --clear-terms revokes it. Reassignment/terms changes increment a config revision and fence in-flight decisions.

## State, snapshot and atomicity

| Action | Required actor/state | Result |
| --- | --- | --- |
| submit | Current verified property owner; draft; current property revision; verified reviewer configured; complete minimum checklist, no unfinished gallery uploads and matching explicit public-display acknowledgement | place becomes review; immutable pending request and submitted snapshot |
| withdraw | Current verified submitting owner; pending request and expected request revision | Request withdrawn; place returns to draft |
| return_changes | Current configured verified reviewer; pending request and expected revision; nonempty correction reason | Request returned; place returns to draft; owner sees reason |
| approve | Current configured verified reviewer; pending/expected revision; current verified owner; unchanged submitted snapshot; same config revision and approved terms; current checklist including the 24-hour calendar boundary and recorded matching public-display evidence | Request approved; place published; property terms version set explicitly |

Submission snapshots saved basics, owner display name, booking settings/charges, information, location/contact/arrival fields, room settings and price-range/configured-night summaries, calendar edit counters, gallery order and ready-photo identities/dimensions. It is not a guest booking quote, full dated calendar export or physical-unit guarantee. Reservation counters are excluded; booking-time price/stock coverage remains authoritative. One deterministic SQL read is compared again inside submission and approval batches. Existing draft-only writes cannot edit a pending review. Pending uploads must finish or be removed first; otherwise the draft lock would prevent their completion. Engineering snapshot bounds are 100 room types and 256 KiB serialized data, not commercial listing limits.

Each command, state change, required attributable event and sealed success receipt shares one D1 batch. A zero-row stale/unauthorized transition cannot leave a successful receipt or partial publication. Required history failure rolls back the whole batch. Request snapshots, terminal requests, events and sealed receipts are retained/immutable. No new notification provider/outbox promise or destructive retention process is introduced.

Review commands use their own owner/reviewer receipt table and actor/key namespace. The existing booking operation schema only permits guest/owner/system roles; it is preserved rather than mislabelling a reviewer or rebuilding existing booking history. As with other operations, a reused review key with a different role/action/payload conflicts. This separate namespace does not change any older endpoint's key contract.

## Access and HTTP contract

All JSON routes use the existing verified session, Origin/JSON write checks, 32 KiB streamed body cap and private/no-store + Vary: Cookie adapter. Mutations require Idempotency-Key. Inputs reject unknown policy/role/state fields. Expected request/configuration revisions are positive safe integers; stale reviewer pages cannot silently approve a newly selected terms version; correction notes are trimmed, at most 2,000 characters and reject unsupported controls. Approval notes are optional.

| Route | Methods and input | Authorized result |
| --- | --- | --- |
| /api/owner/properties/:id/review | GET; POST action=submit/propertyRevision/publicDisclosure or action=withdraw/requestId/revision | Current owned publication state, saved draft/latest submission/correction timeline and content readiness (ready/missing/checks) plus reviewer/terms flags, publicPreview and disclosure evidence; POST 200 id/status receipt |
| /api/property-reviews | GET optional numeric cursor | Configured reviewer only; at most 20 pending requests, oldest first; nextCursor or null |
| /api/property-reviews/:id | GET; POST action=return_changes or approve/revision/configRevision/optional reason | Reviewer only; pending immutable snapshot/timeline, current content readiness and configured terms version; POST 200 id/status receipt |
| /api/property-reviews/:id/photos/:photoId | GET | Submitting current owner or configured reviewer; pending snapshot member and ready media only; processed JPEG |

Unconfigured/unassigned reviewers receive not_found; verification still requires a verified session. Definite conflicts return review_conflict (409), invalid inputs invalid_review (422), missing reviewer reviewer_not_configured (422), unfinished gallery uploads unfinished_photos (422), incomplete content publication_incomplete (422). If readiness changes after preparation but before commit, the batch refuses atomically with review_conflict (409). Technical snapshot bounds use request_size_limit (422). Existing 401/403/404/413/503 handling remains. Private original objects, storage keys/hashes, guest records and role-management are never returned.

Preview authorization is checked before and after storage access, uses private/no-store, Cookie variation and nosniff, and reads only the existing processed metadata-stripped preview. Withdrawal, terminal status, ownership transfer or reviewer revocation ends review-preview access. Downloaded bytes cannot be recalled. Public photo delivery remains undecided.

## Screens, retries and verification

The owner Publication review tab shows saved details and latest submission notes. Reviewer /review and /review/:id pages are private/noindex, with bounded pagination and read-only submitted details. Only the selected verified reviewer sees the review-queue link in their owner workspace. Both views show the shared Publication checklist. Owner drafts link missing items to setup tabs; pending owner and reviewer views do not offer editing links. Submission/approval is disabled when incomplete, but the server remains authoritative. A stale incomplete response requires reload to show the current checklist. The reviewer still assesses accuracy/quality manually; content completeness is not certification.

Uncertain requests keep the same key and frozen payload in the open tab, expose Retry same action and do not create a fresh attempt automatically. Confirmed success refreshes current authorized state; definite stale conflicts require reloading latest status. Tab-close durable recovery remains outside this slice. A recovered receipt retains the original operation result, even after later workflow transitions; current access is still required.

Native tests cover each missing minimum, optional fields, exact Cambodia/leap-day/midnight deadlines, time/capacity changes between read and commit, direct persistence bypass refusal, retained legacy pending/receipts, full/blocked stock, and existing permissions, immutable snapshots/history, missing terms, concurrency, response loss, submission/approval revocation and snapshot races, photo privacy, unchanged booking data and fresh/populated upgrades. Built-Worker HTTP tests exercise real sessions, Origin refusals, safe private JSON/media errors and absence of the fixture-provisioning path. The browser test process alone has an explicit synthetic reviewer provisioner, never imported by the Worker; desktop/phone journeys exercise submit/withdraw/retry/return/resubmit/approve. [Status](../status.md) owns observed results and environment limits; implementation is not a deployment or public-pilot acceptance.

## Guest public display

[Guest browsing](guest-browsing.md) defines the accepted public allowlist and processed-photo reader. New submit inputs include publicDisclosure version/previewHash for the exact guest preview; the owner explicitly checks the notice before sending. Missing acknowledgement uses public_disclosure_required (422), changed public content/order uses public_disclosure_changed (409), and malformed or unknown-version inputs use invalid_review (422). Evidence is immutable and atomic with the request/event/receipt under migration 0012. Earlier successful payloads still replay without added fields, but earlier pending requests require withdrawal/corrections and a newly confirmed submission before a new approval; earlier approvals are not public without this evidence. This does not expose private review packets, original photos or guest booking logistics. No actual legal terms version is selected by this display policy.

## Owner listing visibility (stage A)

The [two-stage scope](../product/published-listing-controls-proposal.md#approval-record--30-october-2026) and [ADR 0007](../architecture/decisions/0007-owner-listing-controls.md) are accepted. Stage A adds private GET/POST /api/owner/properties/:id/listing and controls on the Publication review page. GET returns current publication, monotonic control revision/latest review ID, canPause/canResume/ownerPaused and at most 20 safe attributable-history summaries; no guest data or internal operation IDs are exposed. POST requires exact action pause/resume, nonnegative expected revision, exact current reviewId (nullable for earlier records), confirmed:true and Idempotency-Key. Unknown fields/actions and unconfirmed requests use invalid_listing_control (422).

Pause changes Published to Paused and hides new anonymous catalog/detail/photo reads and online quote/submission access. Existing booking, response deadline, stock, payment, review and snapshot data are not changed. Existing authorized booking actions and owner operational inventory/external allocations continue under their original checks. Resume changes a matching owner-attributed pause back to Published only with current verified ownership and unchanged latest approved public evidence/digest, matching property/approved terms and ready approved-photo metadata. Calendar/reviewer changes do not become new visibility revocation rules. Unknown/historical paused states cannot self-resume.

Migration 0019 creates an initially empty immutable event ledger; it never fabricates earlier consent. Event guards repeat owner/verification/state/revision/latest-review checks; the event effect and sealed owner operation receipt are atomic. Resume evidence is prepared lazily after receipt lookup and fenced at commit. Raw guard refusals use existing booking_conflict (409); failed resume preparation uses listing_resume_unavailable (409), and a composed read detecting a changed control state uses listing_conflict (409). No raw SQL/provider errors are returned.

Owners confirm the visibility/bookings effect before acting. Server HTML controls remain disabled until hydration. An uncertain request freezes its exact key/body/action, including across sign-in in another tab; retries never toggle or invent a fresh key. Successful receipts instruct latest-state reload. Pending intent survives only in the open tab. Replays recheck access and do not reverse a later operation. Recent history is bounded to 20; the full immutable ledger is retained under current technical constraints, without choosing D09's legal duration.

The owner can privately view processed photos while paused; anonymous reads stay unavailable. Stage B offline correction/new review is approved but follows only after stage A verification. Broader D05/D06/D07/D09 and release gates remain separate.

## Offline listing corrections (stage B)

The same private listing POST now also accepts action=reopen with confirmed:true and the current control revision/reviewId. The page offers Start corrections only after a recorded same-owner pause of the current review identity. Confirming it moves Paused to Draft, records the immutable event/receipt and ends direct Resume, including when no field is edited. Existing setup pages then provide supported draft edits. The correction draft remains hidden from public listing/detail/photo and new online requests.

Migration 0020 extends the named context/receipt guards for paused-to-draft reopening; it preserves every 0019 event, all review/booking data and earlier receipts. Old Resume/Reopen success receipts recover their original results without applying another transition. Stale uncommitted actions cannot restore the old approval after reopening or a newer submission/approval. Unknown/historical pauses remain unavailable for self-service reopen as well as resume.

The corrected draft uses the existing checklist, owner public preview/explicit new acknowledgement, immutable new review request and configured reviewer/terms gates. Public-preview hash is part of the submission component key so a changed preview resets acknowledgement. The page labels prior submission confirmation separately from this draft. Withdrawal/return remains offline; only fresh manual approval republishes it.

Preserve stable property/room IDs, submitted booking lines/nightly prices/policies/terms/schedules and existing Confirmed acceptance logistics. Calendar corrections cannot erase reserved units. Existing Pending actions continue under existing rules; a later acceptance gets its own explicitly previewed current logistics copy. Location & contact shows the explicit limitation before saving: corrections do not update already saved Confirmed contact/arrival details or notify those guests. No automatic existing-guest correction or email is introduced.
