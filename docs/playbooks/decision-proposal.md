# Decision proposal playbook

**Status:** active task procedure; does not grant authorization.

**Responsible role:** maintainer (responsibility, not an assigned person).

**Last source verification:** 31 October 2026, main [40f7ffa](https://github.com/kimsourly1912/root-of-cambodia/commit/40f7ffa553a14005f622aa5c846f0f9dc5e70f42).

**Sources:** [open decisions](../product/open-decisions.md), [scope](../product/scope.md), existing proposals such as [published listing controls](../product/published-listing-controls-proposal.md) and [stay operations](../product/stay-operations.md), [ADR index](../architecture/overview.md#decision-records).

## Use when

The next step touches an open decision (D01–D18) or any rule not already in [scope](../product/scope.md). Examples: no-show handling, support powers, retention, public data exposure. Code is not written until the owner accepts the proposal. If scope already covers the rule, use the [feature slice](feature-slice.md) playbook instead.

## Inputs to confirm first

- Which decision IDs are affected, and their current entry in [open decisions](../product/open-decisions.md).
- What the source does today: inspect the services, queries, migrations and routes involved. A proposal that misdescribes current behavior is rejected.
- Whether this task authorizes a docs-only branch/commit/PR for the proposal.

## Steps

1. Create a docs branch (for example `docs/<topic>-plan`) from the current main.
2. Write `docs/product/<topic>-proposal.md` with the canonical header. Include:
   - the problem and who it affects;
   - current behavior with source links;
   - a recommended option, at least one alternative and the cost/maintenance and privacy tradeoffs of each;
   - what stays unchanged (snapshots, stock, existing bookings, privacy boundaries);
   - the staged implementation slices, acceptance tests and failure/retry cases;
   - what remains open after this decision;
   - one explicit agreement question for the owner.
3. Add a dated "proposal" entry in [open decisions](../product/open-decisions.md) that says the choices are **proposed**, not accepted.
4. Update the [status](../status.md) next-steps row and the [docs index](../README.md) product list.
5. Verify with the [documentation change](docs-change.md) checks and open a PR with [PR and handoff](pr-and-handoff.md).

## Recording acceptance

Only the owner's explicit answer to the agreement question accepts a proposal. A PR merge, "ok next" or "continue" does not, unless the owner said they accept the recommendations. When accepted:

- Quote the owner's words and the date in an "Approval record" section of the proposal and in [open decisions](../product/open-decisions.md).
- Mark the decision ID partially or fully resolved, naming exactly what is still open.
- Update [scope](../product/scope.md) if a product rule changed.
- Add an ADR in `docs/architecture/decisions/` (next number) when the decision changes architecture, data boundaries or privacy.

## Done when

- The proposal states current behavior accurately, with links.
- The owner has one clear question to answer.
- No code, schema or config changed in the proposal PR.

## Pitfalls seen in this repository

- Treating "Merged and continue" on a planning PR as acceptance of everything in it. Earlier entries in [open decisions](../product/open-decisions.md) separate the merge from the decision; keep doing that.
- Proposing behavior for data that already exists. Always say what happens to old rows and old receipts, for example "earlier bookings without a copy show unavailable details, with no backfill."
