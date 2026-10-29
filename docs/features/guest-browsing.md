# Guest browsing and public listing contract

**Status:** implemented local candidate; not a staging/public launch claim.

**Responsible role:** product owner (disclosure policy); web/backend maintainer (implementation).

**Last source verification:** 29 October 2026; based on merged main [ef971f1](https://github.com/kimsourly1912/root-of-cambodia/commit/ef971f1a863c6211a9a55fb1223982327fc5fdf7).

**Sources:** [public listing projection](../../packages/backend/src/public-listing.ts), [catalog reads](../../packages/backend/src/catalog-queries.ts), [public adapters](../../apps/web/src/public-http.ts), [pages](../../apps/web/app/stays), [routes](../../apps/web/app/api/stays), [migration 0012](../../packages/backend/migrations/0012_public_listing_disclosure.sql), [native checks](../../tests/catalog.test.ts), [built HTTP checks](../../tests/worker-http.test.ts), [browser flow](../../tests/browser/owner.spec.ts).

## Approved scope

The project owner accepted the [browsing proposal](../product/guest-browsing-proposal.md) with “Merged and continue” on 29 October 2026. Signed-out visitors can browse/search/filter eligible stays and open read-only details. Owner/reviewer flows now preview the exact public fields and record explicit public-display acknowledgement. [ADR 0005](../architecture/decisions/0005-public-listing-boundary.md) records architecture and tradeoffs.

Public fields are property IDs/names/province, description/facilities, active room IDs/names/capacities, check-in/out times, house rules, configured per-stay charge code/label/USD cents and ready photo IDs in approved order. Exact address/coordinates, contact-person/phone/email, arrival notes, owner account identifiers, raw calendar prices/stock, original files, object keys/hashes, review history and display hashes are excluded. Public descriptions/photo pixels can contain intentionally entered information; no OCR/redaction or verification badge is promised.

No guest booking controls, date quotes, availability filters, stay-price teaser, map provider, destination taxonomy, ratings, online payment or real provider is added. Existing booking APIs retain verified access and authoritative dates/prices/stock. D17 private logistics disclosure for Pending/Confirmed/later bookings is unresolved and not implemented here.

## Preview and atomic acknowledgement

Private owner/reviewer reads add publicPreview (version, previewHash, listing) and disclosure (version, previewHash, confirmedAt or null). These remain private/no-store responses. The exact notice is: “I understand these listing details and processed photos will be visible publicly after approval.” Its version is public-listing-v1, separate from actual approved booking terms. Both public content and ready-photo order affect its digest; private logistics and operational calendar counters do not.

New owner submit inputs add publicDisclosure: {version, previewHash}. Missing acknowledgement refuses with public_disclosure_required (422); malformed/unknown fields or version refuse with invalid_review (422); a changed displayed projection refuses with public_disclosure_changed (409). A stale page must reload and explicitly confirm again. Checkbox/input/payload stay frozen during an uncertain result and retries reuse exactly the same key/body.

The service prepares the saved snapshot and verifies the displayed digest. Named persistence compares the complete current snapshot at commit and inserts owner-attributed evidence in the same batch as the review request, state, required event and sealed receipt. SQL seal/approval guards prevent new unconfirmed writes from becoming successful. Required evidence failure rolls back everything. Prior successful receipts are checked before new consent requirements; a key reused with another payload still conflicts.

Reviewers see the same guest preview, while private review context is separately collapsed and stays authorized. New approval requires matching recorded public-display evidence as well as current owner/reviewer/configuration, approved actual terms, unchanged snapshot and the minimum checklist. Returning/withdrawing older pending requests remains possible. Earlier approved listings are not backfilled into browsing and have no new published re-consent/editing operation.

Submission photo snapshot construction now explicitly orders gallery members by their saved positions. Previously stored snapshots/receipts are unchanged; old unconfirmed pending requests must return for acknowledgement before a new approval. Public projection reads preserve approved charge/room/photo order, and the first photo is the cover.

## Anonymous read contract

| Route | Input / result |
| --- | --- |
| GET /api/stays | Optional q/province/cursor; items containing id/nameKm/nameEn/province/cover, nextCursor or null |
| GET /api/stays/:id | Full allowlisted public listing above |
| GET /api/stays/:id/photos/:photoId | Processed approved ready JPEG only; no original route |
| /stays | Server-rendered browse/search/province form, empty/error/loading states and More stays navigation |
| /stays/:id | Server-rendered gallery/information/facilities/room details/rules/charges; unavailable state for ineligible IDs |

Only GET is implemented on the anonymous APIs; writes are 405. No account/session/idempotency key is needed for public reads. q and province are strings of at most 100 raw characters with no ASCII controls. Name search is literal substring matching across saved Khmer/English names, with SQLite ASCII-insensitive English LIKE; %, _, ! and backslash are literal input, not caller-controlled wildcards. Province is an exact saved-text filter with SQLite ASCII NOCASE, not a standardized/geocoded province taxonomy or full Unicode case-folding/transliteration.

Pages contain at most 20 items and use stable property-ID ordering. The cursor is the last returned public property identifier, not private review sequence/history, and a new search clears it. Unknown/duplicate API parameters, arrays, invalid cursors and invalid bounds refuse with invalid_request (422). The page renders a useful invalid-search message. Cursors do not promise a frozen catalog across publications/revocations; corrupt/ineligible projections fail closed and can underfill a page.

Eligibility requires the latest request approved with current disclosure version, currently published property, matching currently verified owner/evidence, and current property terms equal to approved terms. The projection digest must match recorded evidence. Calendar aging, reserved/blocked stock and subsequent reviewer reassignment do not hide an already approved listing. Draft/review/paused/wrong-owner/unverified/old-unconfirmed/invalid-digest records are absent from APIs or 404. SSR uses the stay-unavailable boundary; the JSON API defines the explicit 404 status contract.

SQL selects only public source fields. A fresh-object mapper produces the same allowlist for preview and guest views; no private ReviewSnapshot is passed to public/client components. Listing/detail reads recheck eligible request IDs after digest work. Image reads check state/owner/approved membership/ready metadata together on both sides of R2, and refuse if the approved request changes. Unknown/nonmember/removed photos return 404. An eligible missing processed object returns photo_processing_unavailable (503), without storage keys or raw provider errors.

Anonymous JSON/media use no-store, server-generated X-Request-Id and nosniff; JPEG media has a fixed filename/content type. They neither read a session nor emit auth cookies; the existing local-only runtime still guards every adapter. SSR is force-dynamic. There is no public bucket, signed storage URL, CDN/ISR cache or original-file endpoint. Already downloaded bytes/browser history cannot be recalled; subsequent network reads recheck eligibility.

Unknown failures use the existing safe 503 error contract and allowlisted diagnostics. GET callers retry the same read parameters; no mutation key is required despite the existing temporarily_unavailable_retry_same_key code name. SSR failures are sanitized before framework error handling. No raw SQL, query values, owner/guest content, tokens, storage keys or original bytes belong in diagnostics.

## Verification and operational boundary

Native tests cover missing/changed confirmation, photo-order binding, private-only edits, immutable proof, atomic rollback/recovery, exact public keys, current state/owner/verification, corrupt digests, bounded search/pagination, processed-only storage races and retained-data upgrades. Populated 0011→0012 migration preserves all older rows/receipts and leaves public evidence empty; older pending can correct/resubmit, older approved stay hidden. Existing bookings and stock tests remain.

Actual built-Worker checks exercise anonymous JSON/SSR/media, no-store/no auth cookie, hidden private fields, malformed inputs/read-only methods, paused content and sanitized failure. Matching desktop/phone browser flows cover owner confirmation/stale preview/uncertain retries/review and signed-out browsing/details/decoded photos, private-data absence and overflow; [status](../status.md) and PR evidence own actual outcomes.

Local initialization applies migration 0012 only to local state; no remote migration/deployment is authorized. Pre-0012 code cannot create new submissions under its new seal guard, so a future rollout/rollback must coordinate compatible code and the forward migration without removing privacy evidence. Live permissions/Images fidelity, usage/abuse budgets, retention/recovery, Khmer/accessibility/real-device acceptance and all staged/public release gates remain unverified.
