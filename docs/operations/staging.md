# Cloudflare staging setup

**Status:** partially provisioned; not deployed and not ready for users.
**Responsible role:** project owner for account activation; maintainer for setup.
**Last account/source verification:** 30 October 2026; based on main
[40f7ffa](https://github.com/kimsourly1912/root-of-cambodia/commit/40f7ffa553a14005f622aa5c846f0f9dc5e70f42).
**Sources:** [web configuration](../../apps/web/wrangler.jsonc),
[jobs configuration](../../apps/jobs/wrangler.jsonc),
[release gates](release-and-recovery.md), [current evidence](../status.md).

The owner authorized staging and email setup using only Cloudflare products on
30 October 2026. This authorizes the scoped staging provisioning, configuration,
integration and verification; production traffic, unrelated purchases, legal
approval, retention policy and public pilot readiness are separate.

## Account and resource inventory

| Item | Verified state |
| --- | --- |
| Account | `dcfd514b7e29898cd93e1bbb17b1aa22`, connected as the project's Gmail account |
| Domain | `rootsofcambodia.com`, active; zone `ea10d4d2dd807cef27e6907d6ac1d4c5` |
| Proposed staging origin | `https://staging.rootsofcambodia.com`; no DNS record or Worker route created |
| D1 | Created `roc-staging`, ID `169e1c39-c59a-40c8-8646-b82bbad08a2c`, APAC hint; empty, no application migrations or seed data applied |
| Queue | Created `roc-notifications-staging`, ID `2fdbf2b65e5f4fd780a6deb1eb51c8d6`; no consumer deployed |
| R2 | Not activated: bucket-list API returns 403 / 10042, "Please enable R2 through the Cloudflare Dashboard"; `roc-media-staging` is a proposed bucket, not an existing resource |
| Email Sending | Domain-list and sending-limit API reads both return 401 / 2036, Unauthorized; onboarding and sending entitlement are unverified |
| Email Routing | Domain is disabled/unconfigured; account has no verified destination addresses |
| Images | Storage statistics API returns 403 / 5403; this does not by itself establish Workers image-transformation entitlement |
| Billing | Subscription API is unavailable to the current OAuth connection; Workers plan/cost entitlement is unverified |
| CLI | Pinned Wrangler is installed; `wrangler whoami` reports no CLI authentication. The connected app's credentials are not automatically a CLI login |

Existing apex DNS and the existing unrelated Worker were left intact. No
application secret, live user, real property, email message or remote migration
was created. Recheck existing resource IDs before creating anything on retry.

## Prepared configuration and its limits

Both existing Wrangler files now have an explicit `env.staging`, sharing only
the staging D1/bucket/queue names and keeping local resource identities intact.
Worker names are `roc-web-staging` and `roc-jobs-staging`. Public routes,
workers.dev, preview URLs and Cron are disabled. The email binding allows only
the project account's address for initial controlled testing; it does not
redirect other recipients or authorize sending to arbitrary users.

These are preparation configurations, not functional live adapters. Web auth
and jobs retain their local-only runtime guards. Do not change APP_MODE to
local, use a loopback AUTH_URL remotely or deploy a capture provider to work
around those guards. No new auth/notification email code is written before
sender-domain onboarding and service access are established.

## Required account actions and continuation

1. Activate R2 in this account through the Cloudflare dashboard. The API
   explicitly requires dashboard activation. Preserve private bucket defaults.
2. Restore Email Sending API access: reconnect Cloudflare, then recheck domain
   listing and limits. If 401 persists, use a supported connection with the
   required Email Sending permissions or complete onboarding in the dashboard.
   Do not paste credentials into chat or commit them.
3. Verify Workers/Email Sending and Images entitlements in the dashboard before
   a paid-plan change. No subscription was purchased or upgraded by this task.
4. Reinspect and create only the missing staging resources. Onboard an explicit
   sender on the owned domain without disrupting existing DNS/mail. Confirm
   sender authentication and restrict initial delivery to controlled test
   addresses. All hosting, data, media, queue, scheduling and sending products
   must remain Cloudflare services.
5. Implement and test the real auth-mail and booking-notification adapters,
   including safe errors, bounded provider duration, auth recovery and lost
   acknowledgement behavior. Verify actual provider deduplication semantics;
   a custom message header is not proof of idempotency. Preserve existing
   outbox/lease/booking transaction rules.
6. Establish CLI authentication through the supported secure flow before
   Wrangler deployment; never put an API token in tracked config. Apply ordered
   migrations to the isolated staging D1, configure a separate auth secret,
   then build and deploy the matching web/jobs source. No local capture tables
   or test-only ingress may become the live provider path.
7. Establish restricted staging access before adding the hostname route. Add
   Cron only with the verified provider/recovery path; run controlled real-service
   auth, booking, expiry, queue, media/privacy and failure/recovery checks.
   Record exact source/config/deployment IDs and actual inbox evidence.

The rest of the [release/recovery gates](release-and-recovery.md#release-gates),
including approved terms, retention, abuse limits, recovery ownership and
Khmer/mobile usability, remain prerequisites for collecting real pilot data.
Initial staging verification should use synthetic business data only.

## Recovery

Resources are isolated and empty. Preserve their IDs and reuse them on
continuation. Do not delete a database or queue to fix authentication. Once
staging records exist, follow forward migrations and deliberate reconciliation;
Worker rollback does not undo database changes or sent email.

## Current provider references

- [Cloudflare Email Service](https://developers.cloudflare.com/email-service/)
- [Sender domain onboarding](https://developers.cloudflare.com/email-service/get-started/send-emails/)
- [Workers sending API](https://developers.cloudflare.com/email-service/api/send-emails/workers-api/)
- [Restricted email bindings](https://developers.cloudflare.com/email-service/configuration/send-bindings/)
- [Wrangler environments](https://developers.cloudflare.com/workers/wrangler/environments/)
