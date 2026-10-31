# Owner access and applications

**Status:** implemented locally (slice 3 of the [roles and workspaces decision](../product/roles-and-workspaces-proposal.md)); not on staging until migrations 0021–0022 are applied there.

**Responsible role:** project owner (policy); maintainer (delivery).

**Last source verification:** 31 October 2026, branch `feat/owner-applications`.

**Sources:** [ADR 0010](../architecture/decisions/0010-account-capabilities.md), [services](../../packages/backend/src/features/owner-access/owner-access.ts), [named persistence](../../packages/backend/src/features/owner-access/owner-access-persistence.ts), [queries](../../packages/backend/src/features/owner-access/owner-access-queries.ts), [0021](../../packages/backend/migrations/0021_account_capabilities.sql), [0022](../../packages/backend/migrations/0022_owner_applications.sql), [tests](../../packages/backend/src/features/owner-access/tests/owner-access.test.ts), [browser journey](../../tests/e2e/owner.spec.ts).

## Rules

- Every verified account is a guest. Creating a property needs **approved owner access**. Accounts that owned a property before 0021 were backfilled as approved.
- A verified account applies at `/owner/apply` with a business or owner name, a phone number and the property's province. The phone is for the platform team and is never shown to guests.
- A **different** active platform admin approves or declines a pending application at `/admin/owners`, with a required reason, against the application revision shown. A decline reason is shown to the applicant, who may update the details and apply again.
- Approved access is final in this slice. Suspension and removal wait for D06.
- Owner terms acceptance is not collected yet: the decision calls for an owner terms version, but no owner terms text is approved (D15). `owner_application.terms_version` is constrained to null until a later migration adds the configured, approved version.

## States

| Owner access | Meaning | Applicant sees |
| --- | --- | --- |
| none | Never applied | The application form |
| pending | Waiting for an admin | "Application received" and the submitted details |
| declined | Admin declined with a reason | The reason and the form, prefilled |
| approved | Owner access | Link to the properties; drafts can be created |

## Atomicity, retries and history

`commitOwnerAccess` is the one named save. In one D1 batch it writes the `owner_access_command` (receipt and immutable history: actor, role, action, subject, reason, time), the `owner_access` change and, for applications, the `owner_application` row; a final `owner_access_assert` aborts the batch unless the receipt was sealed. A same-key retry replays the stored receipt before any current-state check; a different payload under the same key is `idempotency_conflict`.

Database guards repeat the rules at commit time: the command actor must be verified; an applicant may only act on themselves; an admin command needs an active admin who is not the subject; a pending-to-decided change needs that admin's in-flight command; approved rows cannot change; commands cannot be edited or deleted. Property inserts need approved owner access (trigger `property_owner_access`), so a draft created by any path is refused without it.

## API

| Route | Who | Result |
| --- | --- | --- |
| `GET /api/owner-access` | Verified account | Own status, application and decline reason |
| `POST /api/owner-access` | Verified account | Apply or reapply; 409 `owner_application_pending` / `owner_access_approved` |
| `GET /api/admin/owner-applications` | Active admin (else 404) | Pending applications, oldest first; applicant's own details and account name/email only |
| `POST /api/admin/owner-applications/{userId}` | Active admin (else 404) | `{action, reason, revision}`; 409 `stale_owner_application` when the application changed |
| `POST /api/owner/properties` | Approved owner | 403 `owner_access_required` otherwise |

All responses are private and no-store through the shared endpoint adapter.
