# Local development setup

**Status:** current active-workspace instructions; commands documented, not executed by this phase.

**Responsible role:** tooling maintainer (responsibility, not an assigned person).

**Last source verification:** 29 October 2026, [607a705](https://github.com/kimsourly1912/root-of-cambodia/commit/607a7057b908a005f9f3529141b0978f52d24ce0).

**Sources:** [package.json](../../package.json), [.node-version](../../.node-version), [pnpm-workspace.yaml](../../pnpm-workspace.yaml), [.github/workflows/verify.yml](../../.github/workflows/verify.yml), [apps/web/scripts/init-local.mjs](../../apps/web/scripts/init-local.mjs), [scripts/handoff-local.ts](../../scripts/handoff-local.ts), [apps/web/package.json](../../apps/web/package.json), [apps/jobs/package.json](../../apps/jobs/package.json).

## Prerequisites and command authority

Run active application commands from the repository root. [package.json](../../package.json) owns the Node engine range and exact packageManager pin; [.node-version](../../.node-version) and [CI](../../.github/workflows/verify.yml) identify the reproducible Node version. The current CI tuple is Node **24.22.1**, pnpm **12.15.0**. Use the pinned manager on PATH or Corepack following that pin; an older global pnpm does not establish the selected version.

Keep the committed pnpm lockfile, isolated install layout, release-age policy, narrow exceptions/overrides and allowed build scripts. Do not disable protections, change dependency pins or introduce another active lockfile to work around network problems. The independent [historical proof](../../proofs/foundation/README.md) alone uses npm.

## Full local verification sequence

The commands below reproduce the checked-in CI order. They install dependencies, write local state, generate files and apply local migrations; run them only within the current task's authorization. This documentation-only phase explicitly prohibits executing them.

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

[init-local.mjs](../../apps/web/scripts/init-local.mjs) first runs the legacy handoff, creates apps/web/.dev.vars with a random BETTER_AUTH_SECRET if absent, applies the single [migration directory](../../packages/backend/migrations/) to local DB via the web config, and creates local_email/local_notification capture tables. It does not seed business properties. Repeating initialization keeps data and skips applied migrations.

Generated binding declarations live in the backend and each app and are excluded from Git. The backend declaration supplies runtime types; each app has its own environment interface. Root types:bindings regenerates them.

Web/jobs previews share root .wrangler/state and the same local D1 identifier; local R2 bindings share the configured bucket. Do not assume tests use that populated preview state: their harnesses are isolated.

## Existing checkout and state handoff

Stop local previews before first handoff. [handoff-local.ts](../../scripts/handoff-local.ts) copies legacy application/.dev.vars to apps/web/.dev.vars if absent; different existing secrets cause refusal. It copies application/.wrangler/state once into root .wrangler/state, retaining the original and an import marker. Competing destination state is refused. The marker prevents a subsequent overwrite of newer workspace data.

Reconcile conflicts explicitly. Never delete a populated database or secret to force initialization. Preserve the application compatibility location and handoff script; they are not active source or disposable cosmetic leftovers.

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

[Web config](../../apps/web/wrangler.jsonc) binds DB, MEDIA, IMAGES and ASSETS, with local APP_MODE/AUTH_URL; BETTER_AUTH_SECRET is local private state. [Jobs config](../../apps/jobs/wrangler.jsonc) binds DB, MEDIA and NOTIFICATIONS. Neither file establishes staging/production resources. No live API credentials are needed for local emulation; never print secret values.

Runtime auth deliberately rejects nonlocal mode/nonloopback AUTH_URL; jobs rejects nonlocal mode before business writes/acknowledgements. Missing local capture tables require authorized initialization, not a guard bypass. Local Images may differ from the service.

Stop a preview occupying port 8787 before browser tests; Playwright refuses to reuse an existing server. A conflicting-state error requires preserving/reconciling both copies. A missing Worker bundle requires the appropriate build, not a new test-only entrypoint. Record actual OS/browser overrides and limitations in verification evidence.

Live resources/providers, migration execution and release are governed by [release/recovery](../operations/release-and-recovery.md), not these local instructions.
