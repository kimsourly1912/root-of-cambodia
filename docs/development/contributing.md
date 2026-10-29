# Contribution and agent standard

**Status:** active repository workflow; task authorization governs scope.

**Responsible role:** maintainer (responsibility, not an assigned person).

**Last source verification:** 29 October 2026, [607a705](https://github.com/kimsourly1912/root-of-cambodia/commit/607a7057b908a005f9f3529141b0978f52d24ce0).

**Sources:** [AGENTS.md](../../AGENTS.md), [.github/pull_request_template.md](../../.github/pull_request_template.md), [docs/archive/README.md](../archive/README.md).

Humans, ChatGPT Work, Codex and other agents use the same root [AGENTS](../../AGENTS.md) and canonical docs. Do not add competing tool-specific architecture or policy instructions.

## Workflow and conflict handling

1. Confirm repository, branch, clean/dirty state, base SHA, task scope and already authorized actions. Preserve unrelated user changes.
2. Read [index](../README.md), [status](../status.md), affected feature/architecture/ADRs and [product rules](../product/scope.md); inspect actual source/config/migrations/tests.
3. Distinguish approved policy, implemented behavior and environment evidence. If they conflict, report the discrepancy and its concrete impact. Code is evidence, not permission to change policy; a plan is not implementation.
4. Define a small plan, non-goals, acceptance/failure cases, checks and recovery implications. Routine reversible engineering choices within authorization do not require repeated permission.
5. Implement only authorized work, preserving module direction and booking/privacy invariants. Avoid unrelated code moves, formatting, dependencies or abstractions.
6. Verify within the allowed environment using [testing](testing.md). Record actual results and skipped/blocked work honestly.
7. Update affected canonical contracts/status together with behavior; use a numbered ADR for substantive architectural decisions. Mark proposed/accepted/superseded/rejected and preserve approval provenance.
8. Deliver a focused PR/handoff explaining outcome, evidence, limits, open decisions and the concrete next owner/action.

Source conventions: strict explicit TypeScript, existing patterns and thin adapters; no generic repositories or extra services without concrete need. See [overview](../architecture/overview.md), [database](../architecture/database.md) and feature contracts for invariant details.

## Authorization

Current task instructions and existing explicit approvals govern actions. Do not treat planning, an accepted stack, a merged example or this standard as blanket authorization to merge, deploy, purchase, change repository settings, mutate production, apply remote migrations, delete data or change retention. Obtain explicit task authorization if not already given. Do not re-request actions already authorized.

Local initialization writes state and applies local migrations. It is permitted only when within task scope; do not run it for a read-only/docs-only task that excludes it. A normal code task may authorize appropriate local checks without a new approval for each command.

The 29 October documentation phase is specifically documentation/instructions only. It excludes code/dependency/schema/config/settings changes, installs, local initialization/migrations, deployment and merging while permitting commit/push/PR creation.

## Definition of done

| Area | Required evidence when applicable |
| --- | --- |
| Behavior | Acceptance and failure/retry/permission states covered; placeholders and implemented/planned differences disclosed |
| Quality | Types/build compatibility and dependency direction preserved; no unnecessary libraries or unrelated churn |
| Tests | Meaningful regression coverage for changed rules, races, replay and uncertain outcomes; affected Worker/browser journeys |
| Database | Reviewed additive migration, fresh/populated checks, atomic operation/allocation/history/outbox/receipt integrity |
| Privacy/security | Server-side access/commit checks, bounded input, private caching/media, safe diagnostics and no secrets/guest content in evidence |
| Documentation | Canonical contracts/ADRs/status updated where affected; file/anchor links checked; historical evidence remains labeled |
| Environment | Exact local/staging/live scope and release gates; no implication that a build authorizes deployment |
| Review | Focused final diff, actual validation and outstanding decisions visible; required CI state reported |

For documentation-only work, validate links/anchors, executable-source accuracy, archive preservation and an allowlist of changed docs/instruction files. Do not invent application test results or run unnecessary behavioral tests.

## Handoff template

Use the PR or issue body, not a permanent file for every chat. The [PR template](../../.github/pull_request_template.md) carries the same fields:

~~~markdown
## Objective
User-visible outcome and why.

## Baseline and scope
Repository, branch, base SHA, affected modules, non-goals and existing changes.

## Authority and evidence
Product/ADR/feature links and source paths; conflicts and resolution.

## Constraints and acceptance
Invariants, authorized environment/actions, success and failure criteria.

## Result
Final behavior and meaningful deviations.

## Verification
Exact commands/outcomes, SHA/CI links, environment and skipped checks with reasons.

## Risks and recovery
Remaining uncertainty, rollout/compatibility limits and rollback/compensation.

## Approvals and next action
Already authorized actions; unresolved decision IDs; concrete next owner/action.
~~~

Do not copy full conversations into the repo. Preserve decisions and evidence. Provider acceptance is not inbox delivery, a mock is not authorization enforcement, and historical tests are not fresh runs.

## Documentation maintenance

New canonical filenames use lowercase kebab-case. Start with status, responsible role, last verified date/SHA and source links. These roles are responsibilities until real people are assigned; do not invent reviewers/CODEOWNERS.

Keep one current status page. Link manifests for versions, setup for commands and status/PR for result counts. Archive only after extracting accepted rules, preserving historical text/evidence and repairing links. [Archive index](../archive/README.md) maps original documents to successors. Relative link relocation may change destinations, never the recorded historical outcome.

ADRs transcribe accepted decisions without reapproving unrelated proposals. Add a superseding decision instead of silently rewriting rationale. A new feature spec should include intent/non-goals, actors, data/invariants, actual endpoints/input/output/errors, retry/concurrency, UI states, verification and open decisions.
