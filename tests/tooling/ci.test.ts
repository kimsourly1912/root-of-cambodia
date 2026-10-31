import { test } from "vitest";
import assert from "node:assert/strict";
import { docsOnly, findVerification, gateKind, reusableReceipt, type Api } from "../../scripts/ci.ts";

test("only the narrow documentation allowlist skips application CI", () => {
  assert.equal(docsOnly(["README.md", "docs/status.md", "docs/architecture/overview.md"]), true);
  assert.equal(docsOnly([]), true);
  for (const file of ["apps/web/app/page.tsx", "docs/example.ts", "docs/schema.sql", "package.json", "pnpm-lock.yaml",
    ".github/workflows/verify.yml", "scripts/ci.ts", "tests/e2e/owner.spec.ts", "AGENTS.md", "public/a.png",
    "docs/../scripts/a.md", "docs/status.md\napps/web/a.ts"]) {
    assert.equal(docsOnly(["docs/status.md", file]), false, file);
  }
});

const application = () => ({
  classify: { result: "success", outputs: { docs_only: "false" } },
  checks: { result: "success" }, build: { result: "success" }, worker: { result: "success" }, browser: { result: "success" },
});
test("the required CI gate rejects skipped, failed or cancelled applicable jobs", () => {
  assert.equal(gateKind(application()), "application");
  for (const job of ["checks", "build", "worker", "browser"] as const) {
    for (const result of ["failure", "cancelled", "skipped", ""]) {
      const needs = application(); needs[job].result = result;
      assert.throws(() => gateKind(needs));
    }
  }
  assert.throws(() => gateKind({}));
  const needs = application(); needs.classify.result = "failure";
  assert.throws(() => gateKind(needs));
  needs.classify.result = "success"; needs.classify.outputs.docs_only = "";
  assert.throws(() => gateKind(needs));
});

test("documentation CI has an explicit successful gate without installing or building the app", () => {
  const needs = application(); needs.classify.outputs.docs_only = "true";
  for (const job of ["checks", "build", "worker", "browser"] as const) needs[job].result = "skipped";
  assert.equal(gateKind(needs), "docs");
  needs.classify.result = "failure";
  assert.throws(() => gateKind(needs));
});

const revision = "a".repeat(40), head = "b".repeat(40), tree = "c".repeat(40), workflow = "d".repeat(40);
const candidate = { run_id: 12, run_attempt: 2, pr_number: 41, head_sha: head };
const context = { ...candidate, repository: "owner/repo", tree, workflow, verified_commit_tree: tree };
const receipt = { version: 1, kind: "application", event: "pull_request", repository: "owner/repo",
  ...candidate, commit: revision, tree, workflow };

test("only the successful run's exact source tree and workflow can reuse PR verification", () => {
  assert.equal(reusableReceipt(receipt, context), true);
  for (const patch of [{ version: 2 }, { kind: "docs" }, { event: "workflow_dispatch" }, { repository: "other/repo" },
    { run_id: 13 }, { run_attempt: 1 }, { pr_number: 42 }, { head_sha: revision }, { commit: "main" },
    { tree: revision }, { workflow: revision }]) {
    assert.equal(reusableReceipt({ ...receipt, ...patch }, context), false);
  }
  for (const value of [null, [], "green", {}, { ...receipt, run_id: "12" }])
    assert.equal(reusableReceipt(value, context), false);
  assert.equal(reusableReceipt(receipt, { ...context, verified_commit_tree: revision }), false);
  assert.equal(reusableReceipt({ ...receipt, run_id: 0 }, { ...context, run_id: 0 }), false);
});

function fixture(options: {
  pull?: Record<string, unknown>; run?: Record<string, unknown>; artifact?: Record<string, unknown>; duplicate?: boolean;
} = {}) {
  const calls: string[] = [];
  const api: Api = async <T>(pathname: string) => {
    calls.push(pathname);
    let response: unknown;
    if (pathname.includes("/commits/")) {
      response = [{ number: 41, merged_at: "2026-10-31T00:00:00Z", merge_commit_sha: revision,
        base: { ref: "main", repo: { full_name: "owner/repo" } },
        head: { sha: head, repo: { full_name: "owner/repo" } }, ...options.pull }];
    } else if (pathname.includes("/workflows/")) {
      response = { workflow_runs: [{ id: 12, run_attempt: 2, event: "pull_request", status: "completed", conclusion: "success",
        path: ".github/workflows/verify.yml", head_sha: head, head_repository: { full_name: "owner/repo" },
        pull_requests: [{ number: 41 }], ...options.run }] };
    } else {
      const artifact = { name: "ci-receipt-2", expired: false, size_in_bytes: 500, ...options.artifact };
      response = { artifacts: options.duplicate ? [artifact, artifact] : [artifact] };
    }
    return response as T;
  };
  return { api, calls };
}

test("verification lookup selects the exact merged PR, workflow, head and successful run attempt", async () => {
  const { api, calls } = fixture();
  assert.deepEqual(await findVerification("owner/repo", revision, api), candidate);
  assert.equal(calls.length, 3);
  assert.ok(calls[1].includes("event=pull_request&head_sha=" + head));
  assert.ok(calls[2].includes("/runs/12/artifacts"));
  assert.deepEqual(await findVerification("owner/repo", revision, fixture({ run: { pull_requests: [] } }).api), candidate);
});

test("untrusted, failed, unrelated or expired proof always requires fresh verification", async () => {
  for (const options of [
    { pull: { merged_at: null } }, { pull: { merge_commit_sha: head } },
    { pull: { base: { ref: "release", repo: { full_name: "owner/repo" } } } },
    { pull: { head: { sha: head, repo: { full_name: "fork/repo" } } } },
    { run: { conclusion: "failure" } }, { run: { conclusion: "cancelled" } }, { run: { status: "in_progress" } },
    { run: { event: "push" } }, { run: { head_sha: revision } }, { run: { path: ".github/workflows/other.yml" } },
    { run: { pull_requests: [{ number: 99 }] } }, { run: { run_attempt: 0 } },
    { artifact: { expired: true } }, { artifact: { name: "ci-receipt-1" } },
    { artifact: { size_in_bytes: 50000 } }, { duplicate: true },
  ]) assert.equal(await findVerification("owner/repo", revision, fixture(options).api), undefined);
  assert.equal(await findVerification("owner/repo", "main", fixture().api), undefined);
  assert.equal(await findVerification("owner/repo/escape", revision, fixture().api), undefined);
});
