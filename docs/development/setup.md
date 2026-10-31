# Local development setup

**Status:** current active-workspace instructions; commands documented, not executed by this phase.

**Responsible role:** tooling maintainer (responsibility, not an assigned person).

**Last source verification:** 29 October 2026, [607a705](https://github.com/kimsourly1912/root-of-cambodia/commit/607a7057b908a005f9f3529141b0978f52d24ce0).

**Sources:** [package.json](../../package.json), [.node-version](../../.node-version), [pnpm-workspace.yaml](../../pnpm-workspace.yaml), [.github/workflows/verify.yml](../../.github/workflows/verify.yml), [apps/web/scripts/init-local.mjs](../../apps/web/scripts/init-local.mjs), [scripts/handoff-local.ts](../../scripts/handoff-local.ts), [apps/web/package.json](../../apps/web/package.json), [apps/jobs/package.json](../../apps/jobs/package.json).

## Fresh clone: run the app locally with test data

Everything below writes only to your machine; nothing touches staging or any remote resource.

1. Install [Node 24.22.1](https://nodejs.org/) (the version in [.node-version](../../.node-version)) and Git.
2. Clone and enter the repository:

   ~~~sh
   git clone https://github.com/kimsourly1912/root-of-cambodia.git
   cd root-of-cambodia
   ~~~

3. Activate the pinned pnpm, install dependencies, then create and fill the local database:

   ~~~sh
   corepack enable
   corepack prepare pnpm@12.15.0 --activate
   pnpm install --frozen-lockfile
   pnpm init:local          # .dev.vars secret, migrations, email capture tables (safe to repeat)
   pnpm types:bindings      # generated binding types (git-ignored)
   pnpm seed:local          # fictional accounts, stays and bookings (safe to repeat)
   ~~~

4. Start the app and open <http://127.0.0.1:8787>. Use exactly this address: on `http://localhost:8787` the pages load, but sign-in fails with `INVALID_ORIGIN` because local auth trusts only the exact origin.

   ~~~sh
   pnpm dev
   ~~~

5. Sign in with a test account. Open `.wrangler/state/local-fixture-logins.txt`, which lists each account's role, email and password; a fresh seed gives all three the same randomly generated password (git-ignored; never commit or share it):

   | Email | Role |
   | --- | --- |
   | `owner@roc-staging.invalid` | Owner with listings and bookings |
   | `guest@roc-staging.invalid` | Guest with one Pending and one Confirmed booking |
   | `reviewer@roc-staging.invalid` | Publication reviewer |

Next time, only `pnpm dev` is needed. After pulling new commits, run `pnpm install --frozen-lockfile` and `pnpm init:local` again to pick up dependency and migration changes. To run tests, follow the [full verification sequence](#full-local-verification-sequence); Windows users who build the Worker should read the Windows note under [running the dev server](#running-the-dev-server-and-seeded-data).

## Prerequisites and command authority

Run active application commands from the repository root. [package.json](../../package.json) owns the Node engine range and exact packageManager pin; [.node-version](../../.node-version) and [CI](../../.github/workflows/verify.yml) identify the reproducible Node version. The current CI tuple is Node **24.22.1**, pnpm **12.15.0**. Use the pinned manager on PATH or Corepack following that pin; an older global pnpm does not establish the selected version.

Keep the committed pnpm lockfile, isolated install layout, release-age policy, narrow exceptions/overrides and allowed build scripts. Do not disable protections, change dependency pins or introduce another active lockfile to work around network problems. The independent [historical proof](../../proofs/foundation/README.md) alone uses npm.

## Full local verification sequence

The commands below reproduce the checked-in CI order. They install dependencies, write local state, generate files and apply local migrations; run them only within the current task's authorization. A documentation-only task that explicitly excludes these operations must not execute them.

~~~sh
corepack enable
corepack prepare pnpm@12.15.0 --activate
pnpm install --frozen-lockfile
pnpm init:local
pnpm types:bindings
pnpm typecheck
pnpm build:worker
pnpm build:jobs
pnpm test
pnpm exec playwright install --with-deps chromium
pnpm test:browser
~~~

If pnpm is already pinned on PATH, Corepack setup is unnecessary. Browser installation requires suitable platform dependencies/access. Network denial is an environment failure, not permission to change the stack.

Both builds are required before the full Vitest suite: the Worker project loads the web output and the prebuilt jobs bundle. `pnpm build` alone is the Next.js build, not the full OpenNext Worker build. `build:jobs` invokes Wrangler with `--dry-run` to create apps/jobs/dist; it does not deploy. See [testing](testing.md) for focused checks and fidelity limits.

## What initialization changes

[init-local.mjs](../../apps/web/scripts/init-local.mjs) first runs the legacy handoff, creates apps/web/.dev.vars with a random BETTER_AUTH_SECRET if absent, applies the single [migration directory](../../packages/backend/migrations/) to local DB via the web config, and creates local_email/local_notification capture tables. It does not seed business properties; `pnpm seed:local` does (see the [fresh clone steps](#fresh-clone-run-the-app-locally-with-test-data)). Repeating initialization keeps data and skips applied migrations.

Generated binding declarations live in the backend and each app and are excluded from Git. The backend declaration supplies runtime types; each app has its own environment interface. Root types:bindings regenerates them.

Web/jobs previews share root .wrangler/state and the same local D1 identifier; local R2 bindings share the configured bucket. Do not assume tests use that populated preview state: their harnesses are isolated.

## Existing checkout and state handoff

Stop local previews before first handoff. [handoff-local.ts](../../scripts/handoff-local.ts) copies legacy application/.dev.vars to apps/web/.dev.vars if absent; different existing secrets cause refusal. It copies application/.wrangler/state once into root .wrangler/state, retaining the original and an import marker. Competing destination state is refused. The marker prevents a subsequent overwrite of newer workspace data.

Reconcile conflicts explicitly. Never delete a populated database or secret to force initialization. Preserve the application compatibility location and handoff script; they are not active source or disposable cosmetic leftovers.

## Running the dev server and seeded data

`pnpm dev` runs `next dev` with the same local D1/R2/Images state through OpenNext's `initOpenNextCloudflareForDev` (see [next.config.ts](../../apps/web/next.config.ts)). It uses port 8787 because local auth only accepts the `http://127.0.0.1:8787` origin. It runs in Node, not workerd, so before a PR also check the real Worker with `pnpm build:worker` and `pnpm preview:worker` (same URL; stop one before starting the other). Tests and CI always use the built Worker.

[seed-local.ts](../../scripts/seed-local.ts) loads the same fictional fixtures as staging into local state only, through the normal backend services: owner, guest and reviewer accounts (`owner@`, `guest@`, `reviewer@roc-staging.invalid`), two published stays with processed photos, one stay pending review, an empty draft, and one Pending and one Confirmed booking. It configures the demo reviewer and clearly fictional demo terms, so publication approval works locally. Passwords are generated once into `.wrangler/state/local-fixture-credentials.json` (keyed by fixture ID, the format the account seeder reads); every seed also rewrites `.wrangler/state/local-fixture-logins.txt` with role, email and password side by side. Both are git-ignored local state; never commit or share them. Re-running keeps existing data and passwords. It refuses when non-fixture accounts or a different reviewer/terms configuration already exist; it never touches staging or remote bindings.

**Windows:** `pnpm dev` works without extra setup. The OpenNext build (`build:worker`) creates symlinks, which fails with `EPERM: operation not permitted, symlink` unless Windows Developer Mode is on (Settings → System → For developers → Developer Mode) or the terminal runs as Administrator. WSL with a Linux distribution also works.

Local scripts that use `getPlatformProxy` pass `.wrangler/state/v3` because `wrangler dev` and `wrangler d1 --persist-to .wrangler/state` append `v3` themselves; passing `.wrangler/state` would open a different, empty database.

## Local previews and email capture

After authorized installation, initialization and builds:

~~~sh
pnpm preview:worker
~~~

Open [local owner preview](http://127.0.0.1:8787/owner). In a separate terminal, `pnpm preview:jobs` starts the local jobs preview. No live Cron schedule is configured by the repository; starting a preview is not proof that scheduled maintenance runs automatically.

Auth verification/reset URLs are captured in local_email, never sent to an inbox. For a local test account, inspect them privately from the root:

~~~sh
pnpm --filter @root-of-cambodia/web exec wrangler d1 execute DB --local --persist-to ../../.wrangler/state --command "SELECT recipient,kind,url FROM local_email ORDER BY rowid DESC LIMIT 5"
~~~

Captured URLs are account credentials: keep output out of commits, screenshots and reports. No product mail-reading endpoint exists. Browser tests' loopback mail bridge is test-only.

## Configuration and troubleshooting

[Web config](../../apps/web/wrangler.jsonc) binds DB, MEDIA, IMAGES and ASSETS, with local APP_MODE/AUTH_URL; BETTER_AUTH_SECRET is local private state. [Jobs config](../../apps/jobs/wrangler.jsonc) binds DB, MEDIA and NOTIFICATIONS. The separate staging environments reference isolated resources; their current inventory and limits are in [staging setup](../operations/staging.md). Neither establishes production readiness. No live API credentials are needed for local emulation; never print secret values.

Web admits loopback local capture, exact-origin staging-read-only, or exact-origin staging-test with private fictional fixture logins. The testing mode enables existing services while refusing registration, verification, account changes and recovery. See the staging contract for trusted fixture setup; never use real customer identities. Jobs rejects nonlocal mode before business writes/acknowledgements. Missing local capture tables require authorized initialization, not a guard bypass. Local Images may differ from the service.

Stop a preview occupying port 8787 before browser tests; Playwright refuses to reuse an existing server. A conflicting-state error requires preserving/reconciling both copies. A missing Worker bundle requires the appropriate build, not a new test-only entrypoint. Record actual OS/browser overrides and limitations in verification evidence.

Live resources/providers, migration execution and release are governed by [release/recovery](../operations/release-and-recovery.md), not these local instructions.

## Local pilot reviewer

After init:local and creating/email-verifying the deliberately selected local app account, provision the [single pilot reviewer](../features/publication-review.md) from the repository root:

```sh
pnpm reviewer:local --user-id <verified-app-user-id>
```

The trusted local command selects no account automatically, rejects unknown/unverified accounts and always uses remoteBindings:false with root .wrangler/state. It is not a web endpoint or remote migration command. Inspect account IDs privately in your local database; a GitHub identity is not an app user ID.

Terms default to unset, which blocks approval. Only after the owner approves actual booking terms and their version, configure that identifier explicitly:

```sh
pnpm reviewer:local --user-id <verified-app-user-id> --terms-version <approved-version>
pnpm reviewer:local --user-id <verified-app-user-id> --clear-terms
```

Omitting the terms option preserves an existing configured version. --clear-terms revokes it; the two terms options are mutually exclusive. The command assigns one reviewer and increments configuration revisions for in-flight fencing. Synthetic test version IDs are not approved legal text. Configuration changes do not rewrite earlier approved requests or booking snapshots. Nonlocal resources/operators and public launch remain separately gated.

## Local booking terms documents

Guest request screens fail closed until the property’s selected terms version has an immutable approved text document, and matches the current pilot terms selection. A version ID by itself is not legal text. After explicit project-owner approval of the actual text/version, an operator can save it locally:

```sh
node scripts/configure-booking-terms-local.ts --version <approved-version> --file <approved-plain-text-file>
```

The command uses only local bindings/state, refuses a different body for an existing version and does not print the content. It does not approve the text or select the reviewer/property version. Use the existing explicit reviewer version configuration separately. No real terms document is created by this implementation; browser/native tests provision clearly synthetic text only. No nonlocal terms/provider/deployment path is authorized.
