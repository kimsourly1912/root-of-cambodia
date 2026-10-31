# Documentation change playbook

**Status:** active task procedure; does not grant authorization.

**Responsible role:** documentation maintainer (responsibility, not an assigned person).

**Last source verification:** 31 October 2026, main [40f7ffa](https://github.com/kimsourly1912/root-of-cambodia/commit/40f7ffa553a14005f622aa5c846f0f9dc5e70f42).

**Sources:** [docs index](../README.md), [contributing](../development/contributing.md#documentation-maintenance), [archive index](../archive/README.md), [check-doc-links.ts](../../scripts/check-doc-links.ts).

## Use when

The task changes only Markdown, agent instructions or the PR template: proposals, status refreshes, contract corrections, cleanup. Docs-only tasks do not install, run `init:local` or run application tests unless the task asks for them.

## Where things go

| Content | Location |
| --- | --- |
| What exists now and its evidence | [status](../status.md), one snapshot |
| Accepted product rules | [scope](../product/scope.md) |
| Unsettled choices | [open decisions](../product/open-decisions.md) |
| Proposals awaiting or holding approval | `docs/product/<topic>-proposal.md` |
| Feature behavior, endpoints, errors | `docs/features/<feature>.md` |
| Architecture decisions | `docs/architecture/decisions/00NN-<topic>.md` |
| Procedures | `docs/playbooks/` |
| Superseded material | `docs/archive/<yyyy-mm>/` with a historical banner |
| Agent entry point | [AGENTS.md](../../AGENTS.md) (shared by all agents); [CLAUDE.md](../../CLAUDE.md) only imports it |

Do not create tool-specific copies of rules (for example a separate Claude or Codex policy file). Keep package READMEs short and pointing to canonical docs.

## Steps

1. Every canonical doc starts with **Status**, **Responsible role**, **Last source verification** (date and SHA) and **Sources**. Update the verification line when you re-check a doc against source.
2. Describe what the source does today. If a doc and code disagree, report it; do not silently rewrite approved policy to match code.
3. Archiving: move the file to `docs/archive/<yyyy-mm>/`, add the banner used by existing snapshots, adjust only relative link targets, and add a row to the [archive index](../archive/README.md). Do not change historical outcomes.
4. Use lowercase kebab-case filenames and relative links.

## Checks

~~~sh
node scripts/check-doc-links.ts          # all Markdown; or pass files/directories
git diff --check                         # whitespace
git diff --stat origin/main              # confirm only intended files changed
~~~

The link checker is read-only and needs no install. Report its output line (files, links, failures) in the PR.

## Done when

- Zero link/anchor failures and clean whitespace.
- The changed-file list matches the task.
- Status, index and any affected contract agree with each other.
