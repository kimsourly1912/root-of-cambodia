# ADR 0010: Account capabilities and role-based areas

**Status:** accepted, 31 October 2026; slice 1 (workspace shell, PR #44) merged; slice 2 (migration 0021, capabilities, admin review, operator command, role-based header) merged in PR #45; slice 3 (owner applications, admin decisions, property-creation gate, migration 0022) implemented; slice 4 pending ([roles and workspaces decision](../../product/roles-and-workspaces-proposal.md)).
**Responsible role:** project owner (policy); maintainer (implementation).
**Last source verification:** 31 October 2026, main [4d2bffb](https://github.com/kimsourly1912/root-of-cambodia/commit/4d2bffb).
**Sources:** [accepted recommendation, alternatives and approval](../../product/roles-and-workspaces-proposal.md), [actor type](../../../packages/backend/src/shared/operations.ts), [reviewer check](../../../packages/backend/src/features/publication/publication-queries.ts), [atomic operations](0002-atomic-booking-operations.md), [feature modules](0008-feature-based-modules.md).

## Context

The actor is only `{ id }`. Owner access is implicit (any verified account can create a draft), and the only privileged power is a single configured publication reviewer. The owner replied “yes go ahead” to the agreement question for one account with guest, owner and platform admin capabilities.

## Decision

- **One account, capabilities from the database.** Guest is every verified account. Owner needs an approved owner application. Platform admin needs an active `platform_staff` grant. Capabilities are not stored in the session or cookie; services read them on each request.
- **Checks where they matter.** Each service checks the capability it needs, and each named persistence function repeats the check inside its atomic batch, as ownership is checked today. Area layouts check only to choose navigation and redirects; they are never the authorization.
- **Grants outside the app.** Admin grants and revocations are written only by a trusted operator command, following the reviewer command. No route grants admin, and there is no first-account rule.
- **Review moves to admin.** Publication review permission becomes "active admin". The configuration revision still fences in-flight decisions when admins or terms change. The existing singleton is migrated, not dropped.
- **Backfill, never rewrite.** The migration records every account that already owns a property as an approved owner and the configured reviewer as an admin. Earlier receipts, snapshots and history are unchanged.
- **Audit.** Admin writes record actor, action, reason and time in the same batch as the change, and reuse existing operation keys and receipts.
- **Privacy.** The first admin slice reads no guest contact or booking details. Wider access waits for the remaining D06 decision.
- **Areas.** Public and guest pages keep the site header; `/owner` and `/admin` share one workspace shell with different menus; `/review` redirects to `/admin/reviews`.

## Alternatives considered

| Option | Why not |
| --- | --- |
| Role in the session or token | Revocation would not take effect at commit time; this project rechecks inside the write |
| Separate owner and guest accounts | Contradicts accepted scope ("a person can be both guest and owner"); duplicated auth and recovery |
| Self-serve owner mode | Weaker "selected owners" control while upload and abuse budgets (D11) are open |
| A generic roles and permissions framework | Speculative for three capabilities; the project avoids generic layers |

## Consequences

- One new ordered migration, with fresh-install and populated-upgrade tests.
- Property creation gains an owner check; existing owners are unaffected because of the backfill.
- Staging fixtures change: the fixture reviewer becomes the fixture admin, and the fixture owner an approved owner.
