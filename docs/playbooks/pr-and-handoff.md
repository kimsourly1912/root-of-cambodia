# PR and handoff playbook

**Status:** active task procedure; does not grant authorization.

**Responsible role:** maintainer (responsibility, not an assigned person).

**Last source verification:** 31 October 2026, main [40f7ffa](https://github.com/kimsourly1912/root-of-cambodia/commit/40f7ffa553a14005f622aa5c846f0f9dc5e70f42).

**Sources:** [PR template](../../.github/pull_request_template.md), [contributing](../development/contributing.md#definition-of-done), [testing](../development/testing.md#report-evidence-precisely), [release and recovery](../operations/release-and-recovery.md).

## Use when

Finishing any task that changed files. Commit, push and PR creation happen only when the task authorizes them; merging needs explicit authorization for that PR.

## Steps

1. Review the final diff: `git diff --stat origin/main` and the full diff. Remove unrelated changes, debug output and formatting churn.
2. Run the checks for the task type ([feature slice](feature-slice.md#local-checks), [schema migration](schema-migration.md#checks) or [docs change](docs-change.md#checks)). Record each exact command and its outcome.
3. Update [status](../status.md) in place following its update rules. Detailed run narratives go in the PR, not status.
4. Commit with a short imperative subject that says what changed (for example "Add guarded owner listing pause and resume").
5. Open the PR with the [template](../../.github/pull_request_template.md). Fill every section; write "None" rather than deleting one.
6. After CI finishes on the final head, record the run link and result in the PR. If it fails, use [CI failure repair](ci-failure-repair.md).
7. Merge only when the owner authorized it and the exact head is green. After merge, confirm the main tree matches the tested head (`git rev-parse <merge>^{tree} <head>^{tree}`) and update the status baseline.

## Reporting evidence

| Say | Do not say |
| --- | --- |
| "Full Vitest: 211 passed (CI 41015058118, head 2f3719a, GitHub Ubuntu)" | "All tests pass" with no run or head |
| "Browser checks not run locally: Chromium download failed; CI is the evidence" | "Verified in the browser" from source reading |
| "Docs-only: link checker 0 failures; no app commands run" | Application test results for a docs-only task |
| "Not inspected: GitHub CLI unauthenticated" | A guess about a run you did not see |

Local emulation is not staging. A dry-run build is not a deployment. Provider acceptance is not inbox delivery.

## Handoff message to the user

End with: what changed (links to files or the PR), the verification results with their limits, decisions still open (IDs), and the single recommended next action and who owns it.
