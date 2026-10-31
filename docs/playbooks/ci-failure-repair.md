# CI failure repair playbook

**Status:** active task procedure; does not grant authorization.

**Responsible role:** maintainer (responsibility, not an assigned person).

**Last source verification:** 31 October 2026, main [40f7ffa](https://github.com/kimsourly1912/root-of-cambodia/commit/40f7ffa553a14005f622aa5c846f0f9dc5e70f42).

**Sources:** [verify.yml](../../.github/workflows/verify.yml), [testing](../development/testing.md), [status log through PR #34](../archive/2026-10/status-log-2026-10-30.md).

## Use when

A "Verify application" run failed on a PR. CI runs, in order: frozen install, `init:local`, bindings, typecheck, both builds, full Vitest, Chromium install, Playwright desktop and phone.

## Steps

1. Read the failing step and the first real error, not the last line. Note the run ID, job ID and head SHA.
2. Classify the failure before changing anything:
   - **Product defect**: the app does the wrong thing. Fix the code and keep or add the test that caught it.
   - **Test defect**: the assertion was wrong for accepted behavior, or a fixture assumed something incidental (revision numbers, total counts, a consumed response body). Fix the test so it checks the same thing correctly.
   - **Environment failure**: download, network or runner problem. Rerun; do not change code.
3. Reproduce locally where possible with the focused command from [testing](../development/testing.md#test-layers-and-commands). Browser failures may only reproduce in CI; reason from the trace and source.
4. Make the smallest fix. Push and wait for a new run on the new head.
5. Explain the failure and fix in the PR body (run link, cause, what changed, why nothing was weakened). Update [status](../status.md) only if the current-main evidence changes.

## Never

- Add retries, longer timeouts, `test.skip`, `.only`, or delete or loosen an assertion to get green.
- Bypass a type error with `any`, `@ts-ignore` or a cast that hides a real mismatch.
- Bypass a local-only runtime guard, or change dependency pins, to get past an environment problem.
- Claim a pass from a run on a different head.

## Pitfalls seen in this repository

| Symptom | Real cause | Fix that worked |
| --- | --- | --- |
| Phone test: form navigated to the URL with a bare query string | Native form submit before hydration | Gate controls on hydration; add a delayed-script browser case |
| "Route is already handled!" | Route cleanup while delayed handlers still ran | `page.unrouteAll({ behavior: "wait" })` before continuing |
| Worker test read an already-used body | Response consumed twice | Read the original receipt once before the replay request |
| Browser test expected HTTP 404 from a page's not-found | A streamed Next.js page cannot be relied on to carry 404 | Assert the denied screen and missing controls in the browser; keep the exact API 404 |
| Upgrade test saw an extra empty table | Test applied all future migrations | Scope the upgrade test to its own migration |
