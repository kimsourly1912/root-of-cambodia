# Private owner supply contract

**Status:** implemented private drafts and a narrow [pilot publication review](publication-review.md); general partner onboarding remains planned.

**Responsible role:** owner-supply maintainer (responsibility, not an assigned person).

**Last source verification:** 31 October 2026; owner-form initialization repair on `fix/owner-form-hydration`, based on main [010dc7f](https://github.com/kimsourly1912/root-of-cambodia/commit/010dc7f6b6fa40a698ae420ebe17d10f6863024e).

**Sources:** [apps/web/app/owner/](../../apps/web/app/owner), [apps/web/app/api/owner/properties/](../../apps/web/app/api/owner/properties), [packages/backend/src/features/properties/property-drafts.ts](../../packages/backend/src/features/properties/property-drafts.ts), [packages/backend/src/features/rooms/room-types.ts](../../packages/backend/src/features/rooms/room-types.ts), [packages/backend/src/features/calendar/calendar.ts](../../packages/backend/src/features/calendar/calendar.ts), [packages/backend/src/features/property-information/property-information.ts](../../packages/backend/src/features/property-information/property-information.ts), [packages/backend/src/features/media/media.ts](../../packages/backend/src/features/media/media.ts).

## Intent, permissions and non-goals

A verified account can create and manage its own private property drafts, room types, dated rates/stock, information, photos and private location/contact/arrival details. One account may be guest and owner; the first draft creates an owner profile without renaming an existing profile. Exact owner/property/room relationships are checked on reads, early service entry, receipt replay and inside atomic writes.

These editing operations are for drafts; published/review/paused editing is not added by this UI. A saved draft does not publish, become bookable, verify the business, submit a partner application or approve platform terms. Its technical `unconfigured` terms version is not publication-ready. General partner/contact submission, live maps/geocoding, broader admin/support and guest/owner booking screens remain planned. [Pilot publication review](publication-review.md) now supports owner submission/withdrawal and the configured reviewer’s corrections/approval. Private draft contact/arrival fields are implemented; guest disclosure remains undecided.

## Identity and access surface

Email/password registration/sign-in, email verification/resend and forgotten/reset-password pages exist in apps/web/app. Better Auth owns GET/POST /api/auth/[...all] through its handler; database-backed auth rate limiting is enabled. Unverified accounts may use verification/recovery but do not gain owner/booking access. Services re-read current email verification rather than trusting browser flags. Mail remains local capture; verification proves inbox control only.

## Fields, bounds and versions

Engineering limits below describe implemented validation, not newly approved commercial/pilot limits.

| Flow | Accepted fields and limits | Version / invariant |
| --- | --- | --- |
| Draft basics | nameKm 1–200 trimmed characters; optional nameEn 0–200; province 1–100; checkinTime/checkoutTime valid HH:mm; policyText 1–10,000; create also ownerName 1–200 | Edit requires positive safe-integer revision; server owns owner/publication/timezone/terms; no inferred platform arrival default |
| Room type | name 1–200 trimmed; adultCapacity 1–100, childCapacity 0–100, totalCapacity 1–100 integers per unit | Edit requires positive revision; capacities do not define age/infant policy; quantity configured per date |
| Calendar | roomRevision and 1–7 distinct ISO nights within seven consecutive date labels; capacity/blocked 0–10,000; unitCents 0–100,000,000 integers | inventoryRevision/rateRevision positive safe integers or explicit null for absent rows; reserved never accepted; blocked + reserved cannot exceed capacity |
| Information | description up to 5,000; address up to 1,000 trimmed characters; ordered facilities max 30 distinct nonempty strings, max 120 each; unsupported controls rejected | Separate revision, null for absent extension then positive; does not increment booking settings/policy version |
| Photo registration | Exact contentType, byteSize, sha256, revision; JPEG/PNG/WebP; 1 byte–8 MiB; 64 lowercase hex hash; null/positive gallery revision | Immutable upload identity/descriptor and server-derived object keys, current draft/owner checked |
| Photo editing | reorder: exact action, revision, complete active ids; remove: exact action, revision, id | Positive gallery revision and exact owned membership; max 20 active photos including pending |

Blank optional information can be cleared while drafting. Facilities are ordered owner-written text, not a verified taxonomy, fee rule or booking policy. Address text is neither geocoded nor verified. Check-in/out times and house rules are owner input; they do not settle D01.

The calendar displays seven nights, supports bulk fill and individual edits, and saves touched dates atomically. USD input retains exact whole cents. Missing rate/stock rows and null versions remain explicit. Reserved is read-only. Save before changing weeks: switching discards unsaved edits. The weekly window is an editing bound, not a stay-length policy.

## Private location, contact and arrival details

The Location & contact tab saves optional draft details through GET/PATCH P/:id/logistics. GET returns latitude, longitude, contactName, contactPhone, contactEmail, arrivalInstructions and revision, defaulting to null coordinates/blank text/null revision when absent. PATCH requires all fields and revision plus Idempotency-Key; success is a 200 id/status=updated receipt.

Latitude/longitude must be finite numbers in [-90, 90]/[-180, 180], supplied together or both null. Zero coordinates are valid. Contact name/phone/email are trimmed single-line strings, bounded to 200/100/254 characters; a nonempty email must have a basic email shape. Arrival instructions allow up to 5,000 trimmed characters with line breaks, rejecting unsupported controls. Unknown ownership, publication, verification or booking-policy fields are rejected. These are engineering validation bounds, not publication requirements.

Service/query/persistence modules are [property-logistics.ts](../../packages/backend/src/features/property-logistics/property-logistics.ts), [property-logistics-queries.ts](../../packages/backend/src/features/property-logistics/property-logistics-queries.ts) and [property-logistics-persistence.ts](../../packages/backend/src/features/property-logistics/property-logistics-persistence.ts). Additive [migration 0010](../../packages/backend/migrations/0010_property_logistics.sql) stores an independently versioned extension and immutable attributable events. A first save checks expected absence; updates check the current positive revision. Data, revision/event and receipt commit atomically with current verified ownership/draft checks. Existing booking settings/revisions, snapshots, rates, reserved stock and outbox records do not change.

Coordinates are owner-entered and not geocoded or verified. Contact methods are informational and unverified; they do not change the sign-in email or trigger messages. Details remain private to the owner and, while submitted, the explicitly configured pilot publication reviewer: no guest/public read endpoint or booking disclosure is added. Arrival notes do not enable check-in, settle arrival/no-show/late-cancellation policy or change accepted terms.

The form supports save/reopen/clear, blank drafts, exact same-key/body recovery after a lost response and refresh/review after a stale conflict. Pending attempts stay only in the open tab. The shared adapter still enforces Origin/JSON bounds/private caching; failures include invalid_property_logistics (422) and existing 401/403/404/409/413/503 codes. The [review contract](publication-review.md) defines submission access and terms gating; the [minimum checklist](../product/publication-checklist-proposal.md) is accepted and enforced for submission/approval, while broader editing/public delivery and guest snapshot/disclosure policy (D05/D17) remain open.

## Implemented HTTP surface

Let P = `/api/owner/properties`, R = `P/:id/rooms` and M = `P/:id/photos`. Params denote actual dynamic segments, not additional route namespaces.

| Route | Methods / inputs | Successful output |
| --- | --- | --- |
| P | GET optional cursor; POST draft create fields | GET items/nextCursor, page size 20; POST 201 receipt id/status=draft |
| P/:id | GET; PATCH edit fields/revision | Owned projection; PATCH 200 id/status=draft |
| R | GET optional cursor; POST room fields | GET items/nextCursor, page size 20; POST 201 id/status=created |
| R/:roomId | GET; PATCH room fields/revision | Exact-parent owned room; PATCH 200 id/status=updated |
| R/:roomId/calendar | GET optional start (default Cambodia today); PATCH calendar payload | GET roomRevision/nights; PATCH 200 id/status=updated |
| P/:id/information | GET; PATCH information/revision | GET description/address/facilities/revision; PATCH 200 id/status=updated |
| P/:id/logistics | GET; PATCH optional draft details/revision | GET private logistics projection; PATCH 200 id/status=updated |
| M | GET; POST descriptor; PATCH reorder/remove | GET revision/photos; POST 201 id/status=pending; PATCH 200 id/status=reordered or removed |
| M/:photoId | PUT raw bytes with exact registered Content-Type; GET ready preview | PUT 200 id/status=ready; GET authenticated JPEG bytes |

Property/room cursors are at most 128 characters. Queries fetch one lookahead item for bounded keyset pagination. Information read defaults to blank values/null revision when absent. Gallery returns id/state/dimensions in saved order, including unfinished assets.

JSON operations use the [common adapter](../../apps/web/server/http.ts): verified session, write Origin equal to AUTH_URL, application/json, streamed 32 KiB cap, private/no-store and Vary: Cookie. Atomic mutations require Idempotency-Key under the [operation contract](../architecture/database.md#replay-and-uncertain-outcomes). Byte PUT uses asset identity/descriptor and the server's readiness operation key instead of a separate client mutation key.

Errors have `{error: code}` and X-Request-Id. Typical refusals: 401 unauthorized, 403 verified-session/Origin, 404 not_found for inaccessible resources, 409 booking_conflict/idempotency_conflict for stale state/save, 413 request_too_large, 422 invalid_property/invalid_room_type/invalid_calendar/invalid_property_information/invalid_photo. Processing/unexpected uncertain errors can return 503; do not interpret that as proof the save failed. No generic field-error envelope or business throttle is claimed; Better Auth is a separate handler.

## Photo processing and recovery

Only still JPEG/PNG/WebP are accepted; SVG/GIF and animated PNG/WebP are rejected. Signatures and decoder format must match. Source dimensions are at most 8,000 pixels per side and 24 megapixels. The Images adapter scales previews within 1,600 × 1,600 and requests JPEG output; backend validation bounds output and strips APP/COM metadata including EXIF/GPS. Originals may contain metadata and have no browser read endpoint.

Registration commits its journal/receipt **before** private immutable conditional R2 writes. Readiness is saved only after original and preview writes. D1 and R2 have no shared transaction; partial work remains private and retryable. Ready retries do not process/write again. Original filenames/storage paths are never client-controlled.

GET previews recheck access after storage read and use private/no-store, Vary: Cookie, image/jpeg and nosniff. Removal denies subsequent reads immediately and records a tombstone; already downloaded bytes cannot be recalled.

Scheduled maintenance deletes both paths for at most 20 due tombstones per call and resweeps at five-minute eligibility intervals even after success, covering late upload writes. No live Cron schedule, abandoned-upload expiry, terminal tombstone purge or retention policy is configured. Physical deletion can lag/stop while maintenance is stopped. See [media ADR](../architecture/decisions/0004-private-media-lifecycle.md).

## Retry, concurrency and UI states

Every draft/room/calendar/information/gallery write commits data, attributable history and receipt together with current verification/owner/draft/revision checks. Expected absence is checked atomically; competing first saves/stale tabs cannot silently overwrite. A later-night/history failure rolls back the entire calendar save. Calendar updates never assign reserved or rewrite submitted booking prices.

The UI supports empty, unsaved, saving, unavailable, uncertain retry and stale-conflict states. It freezes an uncertain attempt and reuses its exact key/body; upload also retains file/asset identity. Pending state lasts in the open tab; closing/reloading loses it. Committed data remains readable through owned lists/views. After closing an unfinished photo attempt, remove that pending asset and select the file again; automatic background resume is not implemented.

Calendar, information and location/contact fields and save controls stay disabled
until their client initialization finishes. This prevents early edits from being
lost when the form initializes its values and expected revision. Browser journeys
delay scripts to verify this boundary before exercising normal saves and recovery.

## Acceptance evidence and unresolved work

[Tests](../../tests/) cover permission/exact-parent refusal, absent/stale/concurrent writes, permission/state races, lost-response replay, atomic audit rollback, populated upgrades, exact cents, private media validation/partial failures/removal/cleanup and actual browser save/reopen journeys. [Testing](../development/testing.md) describes how to run them; [status](../status.md) owns observed results and environment limits.

[D02–D06/D09/D11/D12/D13/D17](../product/open-decisions.md) remain open for occupancy, external details, publication/support, retention/abuse, maps/language and guest disclosure. Public media variants, room photos, live Images fidelity/permissions/budget, private-original retention and real-service recovery need separate decisions/verification.

## Public display boundary

Draft uploads/originals and exact logistics remain private. The owner now previews the explicit [guest listing](guest-browsing.md) and confirms its public fields/processed photos when submitting for review. This does not release an earlier upload/approval, expose an original or define guest booking-state logistics. Approved newly authorized listings use the separate public reader; existing private owner/reviewer endpoints retain their access checks.

## Configured-night operational availability

The separate /owner/properties/:id/availability page lists owned room types with bounded pagination; /:roomId reads seven nights through the existing scoped calendar reader. It remains available across listing states. It exposes the existing /api/inventory versioned one-night update for configured rows, while the draft calendar continues to own initial rates/stock setup. No published content/price editing is added.

Capacity and blocked are editable; reserved/price are read-only. Missing inventory has no save control. A loaded revision protects against concurrent bookings/edits; all authoritative stock/history/receipt guarantees remain in the existing service and named persistence. Successful saves require latest-week reload before another edit. Lost/5xx responses freeze the exact attempt in the open tab; retries preserve the key/body. Stale/definite conflicts require reload. Reload/navigation loses an uncertain in-memory attempt; sign-in opens another tab to preserve it. This slice adds no durable availability-attempt storage or multi-night atomic save.

The [two-step scope](../product/owner-inventory-operations.md) records the authority, alternatives, external reservation follow-up and unchanged policy gates. Browser coverage includes saved counts, lost-response exact retry, stale tabs, reserved-unit protection, missing dates, invalid date links, owner isolation and desktop/phone overflow checks. Actual results belong in status/PR.
