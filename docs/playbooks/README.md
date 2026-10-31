# Agent and contributor playbooks

**Status:** active task procedures; they apply the [contribution standard](../development/contributing.md) and never grant authorization.

**Responsible role:** maintainer (responsibility, not an assigned person).

**Last source verification:** 31 October 2026, main [40f7ffa](https://github.com/kimsourly1912/root-of-cambodia/commit/40f7ffa553a14005f622aa5c846f0f9dc5e70f42).

**Sources:** [AGENTS.md](../../AGENTS.md), [contributing](../development/contributing.md), [testing](../development/testing.md), [status log through PR #35](../archive/2026-10/status-log-2026-10-30.md).

A playbook is a step-by-step procedure for one recurring kind of task. The rules themselves stay in [AGENTS.md](../../AGENTS.md), [scope](../product/scope.md), the architecture docs and feature contracts. Playbooks link to those rules instead of restating them. If a playbook and a canonical doc disagree, the canonical doc wins; report the conflict.

## Pick a playbook

| Task | Playbook |
| --- | --- |
| The owner asked for "the next step", or a change needs a policy choice not in [scope](../product/scope.md) | [Decision proposal](decision-proposal.md) |
| Implement an accepted feature slice | [Feature slice](feature-slice.md) |
| The change needs a table, column, index, trigger or guard | [Schema migration](schema-migration.md) (inside the feature slice) |
| A PR's CI run failed | [CI failure repair](ci-failure-repair.md) |
| Docs-only edit, cleanup or status refresh | [Documentation change](docs-change.md) |
| Finish any task: verify, update status, open the PR, hand off | [PR and handoff](pr-and-handoff.md) |
| Reorganize code into feature folders (only after ADR 0008 is accepted) | [Feature structure migration](feature-structure-migration.md) |

Most implementation tasks use three in order: decision proposal (if policy is open), feature slice, then PR and handoff.

## Common start for every task

1. Run `git status` and `git log -1`. Note the branch, base SHA and any unrelated local changes; preserve them.
2. Read [status](../status.md) for what exists now, then the affected feature contract and ADRs.
3. Write down what the user explicitly authorized in this task (branch, commit, push, PR, merge, local init). Anything else needs asking. Do not re-ask for what was already granted.

## Adding a new playbook

Add a playbook when the same multi-step procedure has been explained in two or more PRs or handoffs. Copy the template below to `docs/playbooks/<kebab-case-name>.md`, add a row to the table above, and run `node scripts/check-doc-links.ts docs`.

~~~markdown
# <Task name> playbook

**Status:** active task procedure; does not grant authorization.

**Responsible role:** maintainer (responsibility, not an assigned person).

**Last source verification:** <date>, main <short SHA link>.

**Sources:** <canonical docs and source paths this procedure relies on>.

## Use when
One or two sentences: the trigger, and when to use another playbook instead.

## Inputs to confirm first
What must be known or authorized before starting.

## Steps
Numbered, concrete actions with real paths and commands.

## Done when
Checkable outcomes.

## Pitfalls seen in this repository
Real failures from PR history, with the fix that worked.
~~~

Keep each playbook short enough to read before starting work (aim for under about 100 lines). Prefer links to contracts over copied rules, and put real commands and file paths in it rather than generic advice.
