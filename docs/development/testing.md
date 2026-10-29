# Verification and testing

**Status:** current verification model; results centralized in status.

**Responsible role:** test maintainer (responsibility, not an assigned person).

**Last source verification:** 29 October 2026, [607a705](https://github.com/kimsourly1912/root-of-cambodia/commit/607a7057b908a005f9f3529141b0978f52d24ce0).

**Sources:** [vitest.config.ts](../../vitest.config.ts), [vitest.backend.config.ts](../../vitest.backend.config.ts), [vitest.worker.config.ts](../../vitest.worker.config.ts), [vitest.tooling.config.ts](../../vitest.tooling.config.ts), [playwright.config.ts](../../playwright.config.ts), [tests/browser/server.ts](../../tests/browser/server.ts), [.github/workflows/verify.yml](../../.github/workflows/verify.yml).

Use the [setup sequence](setup.md) for prerequisites and both builds. [Status](../status.md) is the only current historical result summary; record fresh task results in its PR with SHA, environment and run link. Do not repeat stale counts as current results across READMEs.

## Test layers and commands

| Layer | Runtime / scope | Root command and prerequisites |
| --- | --- | --- |
| Backend | Native workerd/D1 via Cloudflare Vitest plugin; local R2/Images; configured migration discovery/tracking | `pnpm test:backend` after frozen install; no built Next.js entrypoint imported |
| Focused backend file | Same native backend project; choose the changed behavior | `pnpm exec vitest run --project backend tests/calendar.test.ts` (example) |
| Jobs services | Backend project jobs cases | `pnpm test:jobs`; not a substitute for the built-jobs journey |
| Tooling | Node workspace/import/state-handoff checks | `pnpm exec vitest run --project tooling` |
| Built Workers | Node-orchestrated Wrangler actual web Worker and prebuilt jobs bundle | `pnpm test:worker` after **both** `build:worker` and `build:jobs` |
| Full Vitest | All configured backend, worker-http and tooling projects | `pnpm test` after both builds |
| Browser | Playwright Chromium desktop and Pixel 7 phone emulation; actual built web Worker over test-only loopback bridge | Install matching Chromium, free port 8787, `pnpm build:worker` then `pnpm test:browser` |

Local app initialization is needed for ordinary previews and is included in CI before bindings/types. Test harnesses apply migrations into isolated synthetic databases; they do not validate or mutate the populated preview database. Backend scenarios reset test storage and remain sequential within a file while deliberate Promise.all races test contention.

The browser bridge includes a test-only captured-mail reader and synthetic client ingress IPs. It is not bundled as a product API, a real email service or an authorization model.

## Select meaningful checks

For changed semantics, verify the relevant source/migration contracts and add focused regressions for failures that matter. Preserve existing scenarios. Documentation-only edits normally require source/command/link/anchor/whitespace/scope checks; do not install or initialize when the task excludes those operations.

| Changed boundary | Required scenarios as applicable |
| --- | --- |
| Booking/stock | Last-room competition, multi-room/night coverage, later-night rollback, concurrent cancel/expire/external/block, strict deadline/lead-time/cancellation boundaries |
| Operations/replay | Same-key/payload replay, changed-payload conflict, commit timeout before/after save, failed receipt lookup, replay after later state/catalog change |
| Authorization | Missing/unverified sessions, wrong owner/parent, access revoked before replay and between early read and commit |
| Schema | Fresh migrations and populated upgrade with preserved history/snapshots/receipts; rejected preflight without damage |
| Draft/calendar/information | Expected absence/null revisions, stale/concurrent saves, audit failure rollback, exact cents, reserved-counter preservation |
| Media | Declaration/signature/decoder/bounds, private access, partial R2 failure, retries, removal during processing, late writes, cleanup failures and retained tombstones |
| Notifications | Duplicate/missed publish, expired/replaced lease, late worker success/failure, provider success with lost acknowledgement, unavailable recipient recovery |
| UI | Empty/loading/validation, uncertain retry, stale tab, save/reopen, private route access and desktop/phone layout |

Tests live alongside the established [test files](../../tests/); no new framework or automated boundary enforcement is implied by this documentation phase.

## Browser and environment evidence limits

Use the browser matching pinned Playwright where possible. PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH is supported, but record its actual version and downgrade the compatibility claim if overridden. Older archived browser runs used an override; the matching historical CI run is identified in status.

Phone emulation and no-horizontal-overflow checks are not real-device, manual visual, full accessibility, cross-browser or slow-network certification. Native local D1/emulated Images are stronger than standalone SQLite for runtime behavior, but are still not deployed-service tests. A dry-run build is not a deployment.

CI runs on PR/manual events and currently includes frozen installation, initialization/binding/types, both builds, full Vitest, matching-browser install and Playwright. A passing run does not establish that GitHub requires it before merge. Required-check/protection changes need D18 authorization.

## Report evidence precisely

Record exact commands, pass/fail/blocked outcomes, head SHA/run, actual OS/runtime/browser and local/staging/live scope. Label skipped checks with the reason; never present audit/review results as fresh execution. Report environment failures separately from implementation defects. Attach only synthetic, non-secret output.
