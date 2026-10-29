> **Historical snapshot — not current instructions.** Archived 29 October 2026 from [docs/Root-of-Cambodia-Property-Photos-Review.md at 607a705](https://github.com/kimsourly1912/root-of-cambodia/blob/607a7057b908a005f9f3529141b0978f52d24ce0/docs/Root-of-Cambodia-Property-Photos-Review.md). Original dates, decisions, PR states and results below are historical.
> **Current authority:** [docs/features/owner-supply.md](../../features/owner-supply.md), [docs/architecture/decisions/0004-private-media-lifecycle.md](../../architecture/decisions/0004-private-media-lifecycle.md), [docs/status.md](../../status.md).
> Historical text is preserved; relative link destinations are adjusted only for relocation. Do not execute old setup or prototype prompts as current guidance.

<!-- historical-body-start -->

# Private property photos - review

Date: 29 October 2026. Step 6 remains **in progress**. Base: updated main `3dd6fb1ebcf52e2e0a33fe000dd2432cdf027ed7`; PRs #13/#14 are confirmed merged. Branch: `codex/private-property-photos`. No merge, deployment, remote binding, infrastructure creation or service purchase was performed.

## Result and boundaries

The Photos tab lets a verified owner upload, preview, order and remove photos of their own private property draft. Empty, unfinished, saving, uncertain-response, stale-tab and unavailable states are implemented. Publication, public delivery and room-specific photos remain outside this slice. Order is only private gallery order; no public cover-photo policy is assigned.

| Boundary | Responsibility |
| --- | --- |
| Thin Next.js routes/pages | Sessions, Origin for writes, bounded raw input, private/no-store responses and safe diagnostics |
| `media.ts` | Validate declarations/bytes, coordinate processing/storage/readiness and retry removed-file cleanup |
| `media-queries.ts` | Exact verified owner/property/draft reads and server-generated object keys |
| `media-persistence.ts` | Named complete atomic registration/readiness/reorder/removal with events and receipts |
| Migration 0009 | Upload journal, versioned complete gallery, immutable descriptors/removal tombstones and append-only attributable history |
| Web runtime adapter | Images binding; no Node image dependency or Next.js optimizer |
| Jobs Worker | Bounded removed-object cleanup alongside maintenance; no new queue or deployed schedule |

Approved direction is R2/Images and the existing workspace/business/persistence boundaries. Routine engineering limits are 20 active photos including unfinished uploads, 8 MiB per file, 8,000 pixels per side and 24 megapixels. Only still JPEG/PNG/WebP is accepted. SVG/GIF and animated PNG/WebP are rejected. MIME claims are checked against signatures and the Images decoder. Previews are bounded JPEGs; APP/COM segments including EXIF/GPS are stripped again before storage. Originals may contain metadata and have no browser read endpoint. Clients cannot choose filenames/object keys, owners or publication state.

An upload first commits its journal/receipt before R2 writes. SHA-256/size/format, asset identity and derived paths cannot change. Conditional R2 writes create immutable original/preview objects; readiness commits only after both writes succeed. Ready retries do not process/write again. Gallery history/revision is independent of booking settings and information. Reordering requires the exact active owned set and current revision. Data/event/receipt commit or roll back together, rechecking verified ownership/draft status inside D1.

D1 and R2 do not share a transaction. Interruption leaves a private pending asset that the same open-tab attempt can retry. After closing a page, remove the unfinished upload and choose the file again; no background resume/automatic expiry policy is inferred. Removal immediately denies subsequent previews and leaves a tombstone. Maintenance deletes both paths in batches of at most 20, resweeping tombstones at five-minute intervals even after success to catch late in-flight writes. This is recovery, not an approved retention policy. Tombstones/history remain; physical deletion can lag or stop while maintenance is stopped. Already downloaded bytes cannot be recalled.

The UI retains the same registration key/body/file/asset identity after uncertainty and retains original order/removal requests. No booking, inventory, quote or notification persistence module is modified. Applied migrations 0001-0008, dependency pins and root lockfile are retained.

## Verification status

**Implemented and tested with local Cloudflare emulators in GitHub CI; ready for code review in PR #15. Not staging-verified or production-ready.**

Verified source/test/config commit: `4824e54b45ddd71bb1fef1eb1cc8b3b3701685fe`. [Full passing verification run](https://github.com/kimsourly1912/root-of-cambodia/actions/runs/40826965953). Subsequent handoff changes are documentation only.

| Check | Current evidence |
| --- | --- |
| Base, merged dependencies and separate branch | Confirmed |
| Toolchain | Node 24.22.1 and exact pnpm 12.15.0 binary found |
| Frozen install | Passed in GitHub CI with the unchanged lockfile and supply-chain policies; PC installation remains blocked by registry DNS/network access |
| SQL syntax/fresh application | Nine migrations apply to disposable in-memory Node SQLite; supplemental, **not D1 verification** |
| Backend syntax/whitespace | Node TypeScript transformation and `git diff --check` pass; **not a strict typecheck** |
| Generated binding types and strict types | Passed for backend, web, jobs and tests |
| Next.js/OpenNext and jobs dry-run builds | Both passed; no deployment |
| Vitest | **131 passed across 16 files**: all 114 prior tests plus 16 media and one scheduled-cleanup case |
| Playwright | **12 passed**: all ten previous journeys plus the photo journey in desktop and phone emulation |
| Browser version | Pinned Playwright 1.64.1 installed matching Chrome for Testing 156.0.8078.4, build v1248; no executable override |
| Verification workflow | Pinned installation, binding generation, strict types, both builds, Vitest and browser checks passed |

Executed tests cover real emulated R2/Images, validation/metadata, private access, same-key/stale/concurrent actions, partial storage failures, lost responses, processing-time removal/access changes, cleanup failure/late writes, rollback/history and populated upgrade continuity. The actual scheduled handler removes journalled objects. Browser checks cover upload/decoded preview, lost-response retry, order, stale tabs, removal/reload, MIME/byte/Origin bounds and cross-owner/property access. Both layouts pass an automated no-horizontal-overflow check. Full manual visual/accessibility inspection, other engines and real devices remain unverified.

Local handoff: the Windows checkout retains the implementation as working changes over the base commit. The committed remote PR branch is authoritative for continuation; preserve local changes when synchronizing. No dependency pins or lockfile were changed to work around the PC's network limitation.

## Remaining decisions and release gates

Both media bindings explicitly use `remote:false`; apps retain local-only/fail-closed configuration. R2 is the object store; Images transforms raw bytes without hosted Images storage. Authenticated preview responses use `private, no-store`, `Vary: Cookie`, JPEG type and `nosniff`; no public bucket/domain, signed URL or shared cache is added.

Offline Images simulation has limited fidelity. Staging must verify decoding/animation/metadata/orientation, resource permissions, bills/quotas and performance. Before separately authorized live use: approve Images subscription/cost and upload-abuse budget, create isolated private resources, settle abandoned-upload/history retention and cleanup scheduling, and prove recovery under real failures. Per-account/global upload throttling and aggregate storage quotas remain release gates; per-gallery limits alone are insufficient.

Publication criteria, public cover/delivery variants, room photos, moderation and published-property editing remain separate. Map/contact/arrival information, review/publication and guest/owner booking screens remain step 6 work. Arrival/no-show/late cancellation, infant/external-booking/admin rules, provider/domain, retention/recovery policies remain unresolved. Arrival stays blocked. Staging, pilot and production readiness are not established.

Official references checked 29 October 2026:

- [Images raw-byte processing and offline limitations](https://developers.cloudflare.com/images/optimization/binding/)
- [R2/Images setup and subscription prerequisite](https://developers.cloudflare.com/images/tutorials/optimize-user-uploaded-image/)
- [Local versus remote bindings](https://developers.cloudflare.com/workers/local-development/bindings-per-env/)
- [R2 conditional operations](https://developers.cloudflare.com/r2/api/workers/workers-api-reference/)
