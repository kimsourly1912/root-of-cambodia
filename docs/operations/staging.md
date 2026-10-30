# Cloudflare staging setup

**Status:** live read-only preview verified on 30 October 2026.
**Responsible role:** maintainer for staging; project owner for account authorization.
**Last account/source verification:** 30 October 2026, based on main
[40f7ffa](https://github.com/kimsourly1912/root-of-cambodia/commit/40f7ffa553a14005f622aa5c846f0f9dc5e70f42)
and preparation source [2c9bb89](https://github.com/kimsourly1912/root-of-cambodia/commit/2c9bb896e1c4d3af66ccdb24d7edea0082c1cb49).
**Sources:** [web config](../../apps/web/wrangler.jsonc),
[jobs config](../../apps/jobs/wrangler.jsonc),
[runtime policy](../../apps/web/src/runtime-policy.ts),
[HTTP boundary](../../apps/web/src/http.ts), [status](../status.md).

## Instruction and temporary scope

The owner authorized Cloudflare-only staging setup, then activated R2 and
instructed: skip Email Sending for now; proceed with available services until
an account upgrade is announced. No third-party sender or paid upgrade is
introduced. The implementation choice for this instruction is an explicitly
read-only staging preview. It supports anonymous allowlisted browsing and
infrastructure checks. It does not establish a full booking pilot.

The deployed application must use `APP_MODE=staging-read-only` and exactly
`AUTH_URL=https://staging.rootsofcambodia.com`. Existing loopback local mode
retains its captured-mail development behavior. Unknown modes, remote local
capture and other staging origins fail closed. This is a distinct limited
mode, not disabling verification or disguising a remote runtime as local.

## Account and resources

| Item | Actual state |
| --- | --- |
| Account | `dcfd514b7e29898cd93e1bbb17b1aa22`, project account |
| Domain | `rootsofcambodia.com`, active; zone `ea10d4d2dd807cef27e6907d6ac1d4c5` |
| Staging origin | [Live staging preview](https://staging.rootsofcambodia.com/); custom domain enabled, alternative preview/Workers subdomains disabled |
| D1 | `roc-staging`, ID `169e1c39-c59a-40c8-8646-b82bbad08a2c`, APAC hint; existing 0001–0020 applied and tracked; no business data seeded |
| R2 | Created `roc-media-staging` in APAC after successful activation; managed public domain disabled; no objects uploaded |
| Queue | `roc-notifications-staging`, ID `2fdbf2b65e5f4fd780a6deb1eb51c8d6`; retained without consumer or schedule |
| Web | `roc-web-staging`, deployed and verified; runtime source `87052d21f01eec2c5550d7c839bac7c2c01106ed` |
| Jobs | `roc-jobs-staging`, prepared inert config; no deployed consumer/Cron |
| Email | Explicitly deferred by owner; no send binding, live sender, capture table or substitute delivery in staging |
| Images | Staging binding omitted because uploads/processing are disabled; no entitlement upgrade needed for this slice |
| CLI | Pinned Wrangler authenticated as the project account with scoped Workers/D1/route access |
| Access | Account API reports Access not enabled; no organization/policies purchased or created |

Existing apex DNS and unrelated Worker remain unchanged. Resource IDs are
reused on continuation. Do not create another database or queue to work around
authentication.

## Read-only enforcement and limits

- Every business mutation through the shared HTTP boundary and photo-upload
  adapter returns `503 staging_read_only` before authentication, body parsing,
  business services or persistence. Private reads remain unauthenticated.
- Auth endpoints refuse all activity, including GET verification links, before
  Better Auth runs. Only exact `GET /api/auth/get-session` returns `null`, without
  reading or refreshing a session. Server-rendered private routes redirect to
  the unavailable-account screen without consulting a session.
- Sign-in, signup, verification, reset and recovery screens show an honest
  unavailable notice with no credential form. No account is marked verified,
  no token is exposed and no email is reported sent. The mail callback also
  refuses in staging as defense in depth.
- Public catalog projections and processed-only private-R2 photo reads retain
  their existing eligibility/privacy checks. No actual property is seeded and
  no original object is publicly exposed.
- Staging pages have noindex/nofollow metadata. This is an indexing instruction,
  not authentication. The explicit custom domain is enabled in the staging config. This is an empty
  anonymous preview; workers.dev and preview URLs remain disabled.
- Jobs retains its local-only runtime guard. No staged outbox is consumed,
  acknowledged or marked accepted, and no Cron is configured. No recurring
  expiry, cleanup, provider/recovery or inbox-delivery result is claimed.

The [staging built-Worker regression](../../tests/staging-runtime.test.ts) uses
isolated local bindings, applies the real schema there and verifies empty
catalog reads, unavailable auth UI/API, write/upload refusal, private access,
unchanged account/business/outbox counts and absent capture tables. It does
not mutate remote staging or prove live-service behavior.

## Remote migration approval and deployment

On 30 October automatic approval review rejected the first attempt to create
`d1_migrations` in remote `roc-staging`. It stated that persistent remote schema
changes require explicit authorization and contrasted them with the read-only
preview. The preview restriction concerns visitor actions; provisioning its
schema is a separate operator write. No rejected mutation was retried through
a different API, CLI or indirect path. That was the pre-approval state; the approved completion record below supersedes it.

## Approved completion — 30 October 2026

The owner replied **“yes sure, I approve all the ways to finish our staging live
preview”** to the explicit request to apply 0001–0020 to empty roc-staging and
authorize Wrangler Workers/D1/route access. This resolved the earlier automatic
approval blocks for this staging-only operation. Email remains deferred.

- Applied each unchanged ordered SQL file plus its standard d1_migrations entry
  through the connected Cloudflare D1 query API. This uses the same SQL-plus-
  tracking batch as pinned Wrangler's buildMigrationQuery/remote query path.
  No source migration, test fixture, local capture table or business seed was
  added remotely. Each successful file was recorded before continuing.
- Remote verification confirmed all 20 ordered entries, empty foreign-key check,
  quick_check=ok and zero users, places, bookings and outbox records. Pinned
  Wrangler's remote migration listing confirmed **No migrations to apply**.
- Authorized Wrangler through its official device flow and verified the exact
  project account. Generated a separate staging auth secret in process memory
  and supplied it through stdin to secret bulk; its value was never printed,
  stored in project files or committed.
- Uploaded the built web Worker using pinned Wrangler with --env staging and
  --no-autoconfig. The first framework-wrapper invocation rejected the deploy
  message's arguments before upload; direct artifact deployment succeeded.
  No source/dependency or runtime guard was changed to work around it.
- Connected only staging.rootsofcambodia.com through the native custom-domain
  API. Updated the staging route in source to match. Existing apex Worker/DNS
  remained in place. Jobs/queue consumers/Cron remain inactive.

| Deployment evidence | Actual identifier/result |
| --- | --- |
| Tested/deployed runtime source | `87052d21f01eec2c5550d7c839bac7c2c01106ed`, tree `b14a361ebabcd22b12a1e7d72ff0d0f23201ca10` |
| Matching CI | [41048026281](https://github.com/kimsourly1912/root-of-cambodia/actions/runs/41048026281), all install/setup/types/build/test/Chromium/browser steps passed |
| Uploaded code version | `cc08dc4f-866e-4ef4-a124-523f230ab022` |
| Active version after secret configuration | `9d04d48c-284a-4684-b217-19dd9a258eec`, 100% |
| Active deployment | `de27e66e-8a31-4e8b-86aa-d6c1cbde9b3f` |
| Staging custom domain | `df52751893e834f0fdadc23cc593ad7c2c2d942f`, enabled; preview routing off |
| Upload | 70 new assets; 60 existing reused; 1667.01 KiB gzip Worker; reported startup 14ms |
| Remote configuration | Correct D1/R2/ASSETS, exact staging mode/origin and secret binding; no Email/Images binding |
| Live smoke | **18 passed** over real HTTPS, plus desktop browser catalog navigation/visual inspection |

The smoke verified homepage and empty catalog HTML/API, five unavailable account
screens without credential forms, null session without a cookie, signup/sign-in/
reset/booking/property mutation refusals, GET verification refusal, private read
401s, no-store/noindex behavior and stylesheet delivery. Subsequent remote counts
confirm no account/business/outbox side effects and no local capture tables.

The code artifact remains the green runtime source above. The later handoff
commit changes only the custom-domain declaration and documentation to reflect
actual deployment; the runtime was not rebuilt or changed after verification.
No staging content, full booking/auth flow, inbox delivery, live image processing,
load/restore drill, manual Khmer/accessibility or real-device acceptance is claimed.

For later releases, inspect account/resource/migration state first. Keep source
route configuration aligned with the custom domain, preserve the distinct secret
and apply any future approved additive migrations through the controlled release
path. Do not reset staging to make migration history disappear. A code rollback
does not undo database state; consult [release/recovery](release-and-recovery.md).

## Later email and pilot work

Wait for the owner to announce the Cloudflare upgrade. Then verify Email Sending
access/entitlement and sender-domain authentication before implementing sending.
Do not restore write access merely by changing a flag. Implement and verify
actual auth-mail and outbox adapters, provider timeouts/deduplication and lost
acknowledgements, controlled audience access, ordered release and recovery.
A custom message header is not proof of provider idempotency.

[Release/recovery gates](release-and-recovery.md#release-gates) for approved
terms, retention, abuse limits, support ownership, restore and Khmer/mobile
usability still apply before real pilot data. No legal approval, new retention
policy, subscription purchase or full pilot-readiness claim follows here.
