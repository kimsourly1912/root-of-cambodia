# Private pricing and availability setup — review

Date: 29 October 2026. Implementation-plan step 6 remains **in progress**.

PR #12 was merged with explicit authorization. This slice starts from updated main, commit `455f1eee02a5ea9a4b2c4c9c37f3f66e54cdde87`, on its own review branch. No infrastructure deployment was performed.

## Result

Owners can open a saved room type, select a seven-night window and set nightly USD prices, total units and blocked units. They can fill the whole window, adjust individual dates, save touched nights and reopen the saved calendar. Reserved units are read-only; displayed availability is total minus blocked minus reserved. The window is an engineering editing bound, not a stay-length policy.

Private setup still does not publish a property. Public guest quotes remain blocked for drafts. Existing owner-only inventory/external-reservation APIs keep their prior behavior and authorization; their unresolved external-contact/consent/pricing policies are not implemented by this UI.

## Boundaries and decisions

- Thin Next.js routes/pages retain verified sessions, exact property/room authorization, Origin/JSON bounds, private caching and safe diagnostics.
- `calendar.ts` validates a room revision and 1–7 distinct nights within one seven-day span. `calendar-dates.ts` validates ISO date labels and performs date arithmetic; it does not change arrival instants or booking deadlines.
- `calendar-queries.ts` returns seven owned date projections, including explicit null versions for missing inventory/rate rows and support for partially configured dates.
- `calendar-persistence.ts` commits every selected inventory/rate change, immutable event and retry receipt in **one D1 batch**. It checks verified ownership, draft state, room revision, both row revisions and expected absence inside that batch. A stale or failed date rolls back the entire save.
- Additive migration 0007 records actor, night, saved values, reserved snapshot and all three revisions. Existing revision triggers are reused. SQL never assigns the reserved counter; existing database constraints protect newly arriving reservations too.

The approved stack and dependency pins/lockfile are unchanged. Routine choices are a weekly view, saves of touched dates, independent inventory/rate version checks and explicit absence checks. USD text is parsed into whole cents without rounding a floating-point price. Existing schema bounds and zero values remain supported; no commercial minimum price is invented.

The form freezes edits and reuses the exact request/key after an uncertain response. Pending state stays in the open tab; closing it loses that client state, while committed dates remain readable. Changing weeks discards unsaved edits. History is append-only; clearing/deleting dates and retention procedures are outside this slice.

## Fresh local verification

| Check | Result |
| --- | --- |
| Frozen pnpm install, local initialization and generated bindings | Passed; all seven migrations discovered |
| Separate workspace/test TypeScript checks | Passed |
| Next.js/OpenNext web build and jobs dry-run build | Passed |
| Vitest | 105 passed across 14 files: 100 native D1/runtime, 3 tooling, 2 actual built-Worker journeys; all prior 93 retained |
| Playwright | 8 passed: prior six checks plus the calendar journey in desktop/phone emulation |

Eleven new native scenarios cover absent/partial dates, canonical fingerprints, current ownership, exact-parent access, competing creators, concurrent/stale multi-night saves, response-loss recovery, write-time permission/state/version changes, injected audit failure, retained history, validation/leap dates and public-draft gating. A populated migration upgrade preserves every prior row and original property/room/booking receipts.

Tests confirm that rate edits leave original booking prices, allocations, notifications and reserved counters intact, and that a reservation arriving after the read cannot be overwritten even though reservation changes do not increment the inventory revision. The browser journey covers exact 19.99/20.01 USD cents, bulk/daily edits, lost-response recovery, stale tabs, persistence, week navigation and private access. Both layouts were inspected with no horizontal overflow.

All evidence is synthetic/local. Browser checks used the documented Chromium 143 executable override, not a certification against the matching browser, other engines or real devices. Complete accessibility, Khmer localization, real email/HTTPS/D1/Queues/Cron, load and restore checks remain unverified. [D1 batch semantics](https://developers.cloudflare.com/d1/worker-api/d1-database/#batch) and [current limits](https://developers.cloudflare.com/d1/platform/limits/) were checked; no production throughput claim is made.

## Remaining work

Photos/media, address/facilities, publication review/readiness and guest/owner booking screens remain step 6 work. Keep the technical `unconfigured` terms sentinel out of publication. Live integration verification requires separately authorized staging.

Arrival/no-show/late cancellation, infants/age bands, physical-room continuity, external-booking details, admin/support/suspension, provider/domain, reminders, retention and recovery targets stay unresolved. Arrival stays blocked. Existing booking/quote/inventory SQL, public responses/fingerprints, snapshots/history/outbox and migrations 0001–0006 remain unchanged.
