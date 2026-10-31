# ROOTS OF CAMBODIA — Agent instructions

Shared instructions for every coding agent (Codex, Claude Code, Cursor, Copilot)
and human contributor. [CLAUDE.md](CLAUDE.md) only imports this file. Do not add
competing tool-specific rule files.

## Project

A Cambodia accommodation platform. Guests browse stays and send booking requests;
owners accept or decline within 12 hours; the guest pays the property directly.
The platform never collects money.

Current state: a pre-pilot foundation. Owner supply, publication review,
guest browsing, guest and owner booking screens, ordinary arrival/completion,
pay-at-property payment records and owner listing pause/corrections exist. They
run locally, in CI and on a Cloudflare **staging** site limited to fictional test
accounts ([staging contract](docs/operations/staging.md)). Exceptional stays
(no-show, overrides), broad admin/support, real email, deployed jobs and any
production deployment do not exist. [Status](docs/status.md) is the current
source of truth.

## Read before changing anything

1. [Status](docs/status.md): what exists, evidence, next steps.
2. The affected [feature contract](docs/README.md#feature-contracts), the
   [architecture overview](docs/architecture/overview.md) and relevant ADRs.
3. [Product scope](docs/product/scope.md): accepted policy. [Open
   decisions](docs/product/open-decisions.md) are unsettled; they are not
   permission to choose a policy yourself.
4. The [playbook](docs/playbooks/README.md) for your task type.

Inspect the actual source, config, migrations and tests too. If docs, code and
policy disagree, report the conflict and its impact before changing behavior.

## Repository layout

Code is organized **by feature**: one folder per business area holds its code,
UI and tests. Read [feature structure](docs/architecture/feature-structure.md)
before adding or moving files; the tooling test enforces its import rules.

- `packages/backend/src/features/<feature>/`: services, queries, persistence and
  `tests/`; `index.ts` is the only public entry (`@root-of-cambodia/backend/<feature>`).
- `packages/backend/src/shared/`: kernel (errors, operations, access, schema,
  diagnostics, outbox); `packages/backend/src/testing/`: test fixtures.
- `packages/backend/tests/`: cross-feature backend tests.
- `packages/backend/migrations/`: authoritative ordered SQL schema (one directory).
- `apps/web/app/`: thin Next.js routes. `apps/web/features/<feature>/`: that
  feature's components (and `server.ts` when it has server-only adapters).
- `apps/web/components/` (`ui/` primitives, shell), `lib/` (pure helpers),
  `server/` (http, sessions, runtime): shared by two or more features only.
- `apps/jobs`: scheduled and queue adapters that call backend features.
- `tests/integration`, `tests/e2e`, `tests/tooling`: whole-app tests.
- `proofs/foundation`: independent historical npm fixture; not the active app.
- `scripts/handoff-local.ts`: imports state from an older `application/` checkout
  folder if one exists (the tracked folder was removed 31 October 2026); keep.

## Commands

Use the pinned Node (24.22.1) and pnpm (12.15.0) with the committed lockfile.
Full sequence and side effects: [setup](docs/development/setup.md).

~~~sh
pnpm install --frozen-lockfile
pnpm init:local          # WRITES local state and applies migrations; only when the task allows it
pnpm seed:local          # WRITES fictional local test accounts/data; only when the task allows it
pnpm types:bindings
pnpm dev                 # hot-reload app on 127.0.0.1:8787 (Node, not workerd)
pnpm typecheck
pnpm build:worker && pnpm build:jobs   # both are required before pnpm test
pnpm test                # or: test:backend, test:worker, test:jobs
pnpm exec vitest run --project backend tests/<file>.test.ts
pnpm test:browser        # needs matching Playwright Chromium and free port 8787
node scripts/check-doc-links.ts        # read-only Markdown link/anchor check
~~~

## Architecture rules

- Routes and pages stay thin. Business rules live in backend services.
- Feature code stays in its feature; other features use only its public entry.
  Promote code to shared folders only when a second feature needs it.
- One named persistence function owns each complete atomic save.
- `packages/backend` must not import Next.js, React or either app.
- Browser code must not import runtime bindings, persistence or secrets.
- Reuse existing typed patterns. No generic repositories, new frameworks or
  speculative modules. Preserve unrelated changes.
- The web app uses Next.js 16, which differs from older versions. Check the
  bundled docs in `apps/web/node_modules/next/dist/docs/` and heed deprecation
  notices before using Next.js APIs.

## UI rules

Before any screen or component work, read the [UI standard](docs/design/ui-standard.md)
and look up what you need in the [component catalog](docs/design/components.md).

- Build screens from `components/ui` primitives and shared `components/`
  (PageContainer, PageTitle, SectionTitle, TextLink, StatusMessage, EmptyState…).
  Never hand-style a native button, input, select, textarea, heading or link.
- Theme tokens only (`primary`, `muted`, `destructive`…); no palette colors,
  arbitrary values or inline styles. `className` on shared components is for layout.
- Keep element roles, accessible names and heading levels stable: e2e tests use them.
- Cover loading, empty, error, saving, stale and uncertain states
  ([UX patterns](docs/design/ux-patterns.md)); use the [content](docs/design/content.md) terms.
- Missing a component? Add it to `components/` first and to the catalog.
  `pnpm exec vitest run --project tooling` enforces these rules.

The import-direction test covers only part of this; see the
[architecture overview](docs/architecture/overview.md) for known gaps.

## Correctness and privacy rules

- Recheck verified identity and ownership at each sensitive boundary **and again
  at commit time**, inside the write.
- Keep quote/price/terms snapshots immutable. Allow only legal status
  transitions. Never let stock go negative or double-reserve.
- The operation record, its writes, required history and outbox rows, and the
  success receipt commit together in one atomic batch, or not at all.
- After an uncertain outcome, retry with the **same key and same payload**.
  Never automatically create a fresh attempt.
- Validate and bound all server input. Keep private responses and media
  uncached (no-store).
- Never log secrets, tokens, raw provider errors or guest data.
- Follow the [database contract](docs/architecture/database.md).

Schema: add a new ordered migration; never rewrite an applied one. Test fresh
install and populated upgrade.

Runtime modes and guards: keep the explicit runtime mode and exact-origin checks.
- `staging-read-only` refuses accounts and writes.
- `staging-test` admits only the three fictional fixture accounts (private
  passwords, kept outside git) while email is deferred. Public registration and
  recovery stay disabled; jobs stays local-only.
- Never run local email/notification capture remotely, and never bypass a guard
  or weaken verification to make a deployment or test pass.

## Verification and reporting

Run checks that fit the task: see [testing](docs/development/testing.md).
Report the exact commands, outcomes, commit SHA, environment and limits. Old or
skipped checks are not fresh results; a different head's CI is not this head's.
Docs-only tasks do not install, initialize or run application tests unless asked.

Update the affected canonical contract and [status](docs/status.md) with
behavior changes. Do not duplicate evidence in READMEs.

## Authorization

The current task's instructions and approvals already given govern what you may
do. Do not re-ask for actions already authorized.

Never do these without explicit authorization for this task: merge, deploy,
spend money, change repository settings, touch production, delete data, change
retention, or apply remote migrations. Keep PRs focused and use the
[PR template](.github/pull_request_template.md) and
[release gates](docs/operations/release-and-recovery.md). See
[contributing](docs/development/contributing.md) for the full workflow and
definition of done.
