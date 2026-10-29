# ADR 0003: pnpm workspace and reproducible builds

**Status:** accepted; existing owner-requested amendment transcribed.

**Responsible role:** project owner / tooling maintainer (responsibility, not an assigned person).

**Last source verification:** 29 October 2026, [607a705](https://github.com/kimsourly1912/root-of-cambodia/commit/607a7057b908a005f9f3529141b0978f52d24ce0).

**Sources:** [docs/archive/2026-10/Root-of-Cambodia-Pnpm-Workspace-Review.md](../../archive/2026-10/Root-of-Cambodia-Pnpm-Workspace-Review.md), [package.json](../../../package.json), [pnpm-workspace.yaml](../../../pnpm-workspace.yaml), [pnpm-lock.yaml](../../../pnpm-lock.yaml).

**Original amendment:** 28 October 2026. **Transcribed:** 29 October 2026.
**Approval provenance:** the archived pnpm review records the owner's explicit request after the earlier workspace/jobs implementation. It supersedes npm tooling guidance for the active application, retaining the approved layout and stack.

## Context and decision

Use the root packageManager pin, Node engine constraint and committed pnpm lockfile. The workspace contains exactly apps/web, apps/jobs and packages/backend; private backend links use workspace:*.

Retain isolated installation, exact versions, strict release-age checks with existing narrow exceptions/overrides and explicit native-build permissions. No hoisting workaround, task orchestrator or framework replacement. The proof remains outside the workspace with its independent npm lockfile. OpenNext chooses a package manager from lockfiles; do not introduce a second active lockfile.

## Alternatives and consequences

Native npm workspaces were the prior approved setup. pnpm replaces that manager choice at the owner's request, not the runtime architecture. Frozen installation and coordinated adapter/build verification support repeatability, with supply-chain settings maintained rather than bypassed to fix a network failure.

See [setup](../../development/setup.md) for the single active command sequence. Current versions come from executable manifests, not duplicated ADR version lists.

## Supersession and boundaries

Supersedes active npm guidance in archived architecture/workspace/technical plans. It does not supersede the historical proof's reproduction tuple, authorize dependency upgrades or remove the legacy local-state handoff bridge.
