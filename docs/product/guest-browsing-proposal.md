# Proposed first guest-browsing slice

**Status:** proposed; public disclosure and media choices require project-owner agreement before implementation.

**Responsible role:** project owner (disclosure policy); maintainer (implementation after agreement).

**Last source verification:** 29 October 2026, merged main [d7e70bb](https://github.com/kimsourly1912/root-of-cambodia/commit/d7e70bbe9d0c0d18b34cfedaf4d143b0f59f89d2).

**Sources:** [accepted scope](scope.md), [D05/D17](open-decisions.md), [current delivery](../status.md), [architecture](../architecture/overview.md), [private media ADR](../architecture/decisions/0004-private-media-lifecycle.md), [review snapshot](../../packages/backend/src/publication-queries.ts), [private photo reads](../../packages/backend/src/media-queries.ts), [booking contract](../features/bookings.md), [current runtime guard](../../apps/web/src/runtime.ts).

## Where we are

PR #21 is merged. Owner setup, review/corrections, the minimum publication checklist and booking APIs exist. The active app still has no public stay list/detail routes or guest booking screens. Current review snapshots contain private address/contact/arrival data; current photo readers require owner/reviewer authorization. A published database status currently enables booking APIs, not public photo delivery.

Recommendation: build guest browsing before request/review/booking screens, as one small local implementation slice. It gives signed-out visitors a real list and property detail page while making the public/private boundary explicit. This proposal does not approve public launch or define how confirmed guests receive private logistics later.

## Proposed product scope

| Surface | First slice |
| --- | --- |
| Browse /stays | Published and explicitly authorized listings; bounded Khmer/English name search, province filter and pagination; photo, names and province; real empty/loading/failure states |
| Property /stays/:id | Approved photo gallery, names/province, description, facilities, active room names/capacities, check-in/out times, house rules and configured per-stay charges |
| Owner submission | Preview exactly the public fields/photos and explicitly acknowledge public display before a new submission intended for the catalog |
| Reviewer | Review the same public preview alongside the existing private review context; keep the existing manual decision, checklist and explicit approved-terms gate |

No login is needed to browse. Existing verification rules still govern booking actions. Only accommodation is included; no destination taxonomy, map provider, ratings, popularity ranking, payment collection or other-category workflow is added.

Dates, availability filters, exact stay quotes, room selection, request submission, My bookings and owner response screens follow in separate focused slices. Do not show a stale “from” price from the review snapshot or imply a room is available without a current date-specific quote. This slice adds working browsing/detail navigation, with no inactive booking widgets or simulated booking success.

## Recommended public/private split

| Data | Anyone browsing | Boundary |
| --- | --- | --- |
| Khmer/optional English property names and province | Public | Saved approved listing content; province only for location in this slice |
| Description and facilities | Public | Owner preview and manual review; no invented verified-amenity claims |
| Active room names/capacities, times, house rules, per-stay charges | Public | Approved listing details; not a complete stay quote, availability promise or new child/infant policy |
| Processed, metadata-stripped photos | Public | Ready members of the explicitly authorized approved gallery only; first saved photo is the cover |
| Exact address and coordinates | Hidden | Keep private during browsing; guest booking disclosure remains D17 |
| Contact-person name, phone, email and arrival notes | Hidden | No contact endpoint or guest disclosure is inferred from owner setup |
| Originals, storage keys/hashes, owner account identifiers, internal review/history/receipts and raw calendar counters | Hidden | Public route identifiers are not authorization; never return the full private review packet |

Public descriptions and photo pixels can themselves contain location/contact information. Metadata stripping does not redact visible content. The owner preview and reviewer must assess what they intentionally make public; no automatic OCR/redaction or quality certification is promised.

D17 remains open for Pending/Confirmed/later booking states, whether to use current or snapshotted logistics, the snapshot moment and handling later corrections. This proposal only establishes what anonymous browsing may show. No address/contact snapshot migration or disclosure to a booking guest is authorized by accepting this slice.

## Explicit authorization and earlier approvals

Recommendation: add an explicit public-display acknowledgement to the new submission flow, tied to a disclosure-policy version and the submitted content/gallery. Suggested notice: “I understand that these listing details and processed photos will be visible publicly after approval.” This is a concrete content-release choice, not approval of legal/privacy terms or a warranty invented on the owner's behalf.

Record the selected version with attributable submission/review evidence in the same atomic operation. Require an approved request carrying that authorization before anonymous catalog/media reads. Preserve existing receipts and immutable old snapshots; add an ordered migration only if needed for the new record. Do not retrofit consent into old history or infer it from signup, an owner upload, the checklist or an earlier approval.

Existing approved listings without this explicit authorization stay outside the new public catalog. Published editing/re-consent/re-review is still separate D05 scope; do not invent a manual SQL workaround or reopen published drafts. The first local slice can validate the complete path using newly prepared fictional listings. Any real earlier listings need a separately agreed transition before public pilot use.

## Architecture and media recommendation

Keep Next.js/OpenNext, shadcn/ui and the shared backend on Workers/D1/R2/Images. Add a narrowly defined public listing read model with an allowlist of fields, rather than serializing the private ReviewSnapshot. Server pages and any public JSON route use that same projection. Owner/reviewer and booking endpoints keep their existing private authorization.

Eligibility requires current published state, a currently verified matching owner and an approved authorized submission for that owner. Draft, pending-review, paused, wrong-owner and non-authorized records are absent/404. Do not reuse the time-sensitive calendar-readiness gate to automatically hide an already published listing when its dates age out or stock fills. Existing booking availability remains authoritative.

Serve existing processed previews through a dedicated read-only web route. Keep the R2 bucket and originals private. Validate current eligibility and approved gallery membership before and after object access; removed/non-ready/nonmember media cannot be fetched by guessing IDs. Use fixed JPEG content type, nosniff, bounded failures and accessible image-unavailable states; expose no storage credentials or object keys. Previously downloaded public bytes cannot be recalled.

Start dynamic and no-store for the catalog/detail/media responses, with no shared CDN/ISR caching. This simplifies hiding content after a state/ownership change. It sends more reads through Workers/R2; usage and live-service budgets still need review before launch. A later cache policy needs an explicit invalidation/revocation design. No new vendor, public bucket, subscription, resources, deployment or runtime-guard bypass is part of this local slice.

## Alternatives and consequences

| Decision | Recommendation | Reasonable alternative / effect |
| --- | --- | --- |
| Browse location | Province only | Public full address helps guests assess a precise location but exposes private accommodation addresses; exact coordinates also need a map/disclosure decision |
| Photo delivery | Routed processed previews; originals private | Direct public storage/CDN can reduce application reads, but makes revocation/cache behavior more complex and needs a separately reviewed infrastructure path |
| Earlier approvals | Require explicit owner authorization and review evidence | Treating every earlier approval as public is less work but changes the expectation attached to previously private uploads; not recommended |
| Initial scope | Read-only guest browsing/detail | Build browsing, booking and private logistics together: larger review/test surface and requires D17 and additional guest policy decisions now |

## Acceptance and verification after agreement

- Real anonymous browse/search/filter/pagination/detail navigation; correct Khmer/Latin display and desktop/phone layout using existing components.
- New owner public preview/acknowledgement and reviewer approval produce exactly the authorized public fields/photos. The notice and approved version are visible in review evidence.
- Public pages, JSON, HTML and hydration data contain no excluded private fields, storage keys or original bytes. Private owner/reviewer endpoints retain current access checks.
- Draft/review/paused/old-unconsented/ownership-changed listings and nonmember/removed media are refused, including changes during storage access. Public reads do not depend on a reviewer still holding today's assignment.
- Existing published listings are not automatically removed merely because dates pass or stock is reserved/blocked. No new price/availability guarantee appears.
- Preserve same-key receipts, state/version/ownership guards and rollback/history atomicity in any submission change. Existing receipts/old snapshots survive any necessary additive migration; no bulk public release or destructive migration.
- Frozen pnpm install, types, both Worker builds, relevant native/built-Worker tests and matching-browser desktop/phone checks. Verify fresh/populated upgrades if schema changes are needed.
- Local emulation only. Real Images/R2 permissions/fidelity, HTTPS, abuse/storage budgets, operator/recovery, Khmer/accessibility acceptance and live deployment remain separate release gates.

## Decision requested

Agree with the public/private split, first-approved-photo cover, routed processed-only delivery and explicit owner acknowledgement before public eligibility, or specify changes. Approval would authorize this focused local browsing implementation and its tests. It would not settle D17 booking disclosure, broader D05 published editing, actual legal terms, spend or deployment. Until agreement is recorded, this remains a proposal and all current private readers stay unchanged.
