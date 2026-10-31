// CI orchestration only. No application bindings or deployment credentials.
import { execFileSync } from "node:child_process";
import { appendFile, lstat, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

const root = path.resolve(import.meta.dirname, "..");
const shaPattern = /^[a-f0-9]{40}$/;
const workflowPath = ".github/workflows/verify.yml";
const git = (...args: string[]) => execFileSync("git", args, {
  cwd: root, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"], maxBuffer: 8 * 1024 * 1024,
}).trim();

export function docsOnly(files: readonly string[]) {
  return files.every(file => file === "README.md" ||
    (!file.split("/").includes("..") && /^docs\/.+\.md$/.test(file)));
}

export function gateKind(needs: Record<string, { result: string; outputs?: { docs_only?: string } }>) {
  if (needs.classify?.result !== "success" || !["true", "false"].includes(needs.classify.outputs?.docs_only ?? ""))
    throw new Error("Change classification or documentation checks did not pass.");
  const onlyDocs = needs.classify.outputs!.docs_only === "true";
  for (const job of ["checks", "build", "worker", "browser"]) {
    if (needs[job]?.result !== (onlyDocs ? "skipped" : "success"))
      throw new Error("A required CI job failed, was cancelled, or was unexpectedly skipped.");
  }
  return onlyDocs ? "docs" : "application";
}

type Run = {
  id: number; run_attempt: number; event: string; status: string; conclusion: string;
  path: string; head_sha: string; head_repository?: { full_name: string };
  pull_requests?: { number: number }[];
};
type Pull = {
  number: number; merged_at: string | null; merge_commit_sha: string;
  base: { ref: string; repo: { full_name: string } };
  head: { sha: string; repo: { full_name: string } | null };
};
export type Candidate = { run_id: number; run_attempt: number; pr_number: number; head_sha: string };
export type Api = <T>(pathname: string) => Promise<T>;

export async function findVerification(repository: string, revision: string, api: Api): Promise<Candidate | undefined> {
  if (!shaPattern.test(revision) || !/^[\w.-]+\/[\w.-]+$/.test(repository)) return;
  const pulls = await api<Pull[]>(`/repos/${repository}/commits/${revision}/pulls?per_page=100`);
  const matching = pulls.filter(pr => pr.merged_at && pr.merge_commit_sha === revision &&
    pr.base.ref === "main" && pr.base.repo.full_name === repository && pr.head.repo?.full_name === repository &&
    Number.isSafeInteger(pr.number) && pr.number > 0 && shaPattern.test(pr.head.sha));
  if (matching.length !== 1) return;
  const pr = matching[0];
  const { workflow_runs: runs } = await api<{ workflow_runs: Run[] }>(
    `/repos/${repository}/actions/workflows/verify.yml/runs?event=pull_request&head_sha=${pr.head.sha}&status=success&per_page=10`);
  for (const run of runs) {
    if (run.event !== "pull_request" || run.status !== "completed" || run.conclusion !== "success" ||
        run.path !== workflowPath || run.head_sha !== pr.head.sha || run.head_repository?.full_name !== repository ||
        // GitHub often clears this list after merge. The associated merged PR,
        // exact head and receipt PR number still bind the proof to this release.
        (run.pull_requests?.length && !run.pull_requests.some(p => p.number === pr.number)) ||
        !Number.isSafeInteger(run.id) || run.id < 1 ||
        !Number.isSafeInteger(run.run_attempt) || run.run_attempt < 1) continue;
    const { artifacts } = await api<{ artifacts: { name: string; expired: boolean; size_in_bytes: number }[] }>(
      `/repos/${repository}/actions/runs/${run.id}/artifacts?per_page=100`);
    const receipts = artifacts.filter(a => a.name === `ci-receipt-${run.run_attempt}`);
    if (receipts.length === 1 && !receipts[0].expired && receipts[0].size_in_bytes > 0 && receipts[0].size_in_bytes <= 32768)
      return { run_id: run.id, run_attempt: run.run_attempt, pr_number: pr.number, head_sha: pr.head.sha };
  }
}

type ProofContext = Candidate & { repository: string; tree: string; workflow: string; verified_commit_tree: string };
export function reusableReceipt(receipt: unknown, context: ProofContext) {
  if (![context.run_id, context.run_attempt, context.pr_number].every(n => Number.isSafeInteger(n) && n > 0) ||
      ![context.tree, context.workflow, context.verified_commit_tree, context.head_sha].every(s => shaPattern.test(s))) return false;
  if (!receipt || typeof receipt !== "object" || Array.isArray(receipt)) return false;
  const r = receipt as Record<string, unknown>;
  return r.version === 1 && r.kind === "application" && r.event === "pull_request" &&
    r.repository === context.repository && r.run_id === context.run_id && r.run_attempt === context.run_attempt &&
    r.pr_number === context.pr_number && r.head_sha === context.head_sha &&
    typeof r.commit === "string" && shaPattern.test(r.commit) &&
    r.tree === context.tree && r.tree === context.verified_commit_tree && r.workflow === context.workflow;
}

async function output(name: string, value: string | number | boolean) {
  if (process.env.GITHUB_OUTPUT) await appendFile(process.env.GITHUB_OUTPUT, `${name}=${value}\n`);
}
async function summary(value: string) {
  if (process.env.GITHUB_STEP_SUMMARY) await appendFile(process.env.GITHUB_STEP_SUMMARY, value + "\n");
  console.log(value);
}
async function event() {
  return JSON.parse(await readFile(process.env.GITHUB_EVENT_PATH!, "utf8")) as {
    before?: string; pull_request?: { number: number; base: { sha: string }; head: { sha: string } };
  };
}
function checkout() {
  const commit = git("rev-parse", "HEAD");
  if (!shaPattern.test(process.env.GITHUB_SHA ?? "") || commit !== process.env.GITHUB_SHA)
    throw new Error("CI checkout does not match the triggering commit.");
  return { commit, tree: git("rev-parse", "HEAD^{tree}"), workflow: git("rev-parse", `HEAD:${workflowPath}`) };
}
const api: Api = async <T>(pathname: string) => {
  const response = await fetch("https://api.github.com" + pathname, {
    headers: { Authorization: `Bearer ${process.env.GH_TOKEN ?? ""}`, Accept: "application/vnd.github+json",
      "X-GitHub-Api-Version": "2022-11-28" },
    redirect: "error", signal: AbortSignal.timeout(10000),
  });
  if (!response.ok) throw new Error("GitHub verification evidence unavailable.");
  return await response.json() as T;
};

async function main(command: string) {
  const source = checkout();
  if (command === "classify") {
    let onlyDocs = false;
    if (process.env.CI_FORCE_FULL !== "true") {
      try {
        const payload = await event();
        const base = process.env.GITHUB_EVENT_NAME === "pull_request" ? payload.pull_request?.base.sha : payload.before;
        if (base && shaPattern.test(base) && !/^0+$/.test(base)) {
          const files = execFileSync("git", ["diff", "--no-renames", "--name-only", "-z", base, source.commit],
            { cwd: root, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"], maxBuffer: 8 * 1024 * 1024 });
          onlyDocs = docsOnly(files.split("\0").filter(Boolean));
        }
      } catch { /* Unknown history/input must take the full verification path. */ }
    }
    await output("docs_only", onlyDocs);
    await summary(onlyDocs ? "Documentation-only change: documentation checks; no application build or deployment." : "Application or uncertain change: full verification required.");
  } else if (command === "receipt") {
    const kind = gateKind(JSON.parse(process.env.CI_RESULTS ?? "{}"));
    const payload = await event();
    const receipt = { version: 1, kind, ...source, repository: process.env.GITHUB_REPOSITORY,
      event: process.env.GITHUB_EVENT_NAME, run_id: Number(process.env.GITHUB_RUN_ID),
      run_attempt: Number(process.env.GITHUB_RUN_ATTEMPT), pr_number: payload.pull_request?.number,
      head_sha: payload.pull_request?.head.sha };
    await writeFile(path.join(process.env.RUNNER_TEMP!, "receipt.json"), JSON.stringify(receipt));
    await summary(`CI gate passed (${kind}); tested commit ${source.commit}, tree ${source.tree}.`);
  } else if (command === "find") {
    let candidate: Candidate | undefined;
    try { candidate = await findVerification(process.env.GITHUB_REPOSITORY!, source.commit, api); }
    catch { /* Missing/forbidden/expired evidence requires fresh CI, never a bypass. */ }
    for (const key of ["run_id", "run_attempt", "pr_number", "head_sha"] as const)
      await output(key, candidate?.[key] ?? "");
  } else if (command === "reuse") {
    let reusable = false;
    try {
      const filename = path.join(process.env.RUNNER_TEMP!, "ci-receipt", "receipt.json");
      const info = await lstat(filename);
      if (!info.isFile() || info.isSymbolicLink() || info.size > 16384) throw new Error("Invalid receipt.");
      const receipt = JSON.parse(await readFile(filename, "utf8"));
      if (typeof receipt.commit !== "string" || !shaPattern.test(receipt.commit)) throw new Error("Invalid receipt.");
      const tested = await api<{ tree: { sha: string } }>(`/repos/${process.env.GITHUB_REPOSITORY}/git/commits/${receipt.commit}`);
      reusable = reusableReceipt(receipt, { repository: process.env.GITHUB_REPOSITORY!, ...source,
        run_id: Number(process.env.CI_RUN_ID), run_attempt: Number(process.env.CI_RUN_ATTEMPT),
        pr_number: Number(process.env.CI_PR_NUMBER), head_sha: process.env.CI_HEAD_SHA ?? "",
        verified_commit_tree: tested.tree.sha });
    } catch { /* A malformed, mismatched or unavailable proof takes the full CI path. */ }
    await output("verified", reusable);
    await summary(reusable ? "Reusing successful PR verification of this exact file tree; no duplicate application tests." : "No matching successful PR verification receipt; full CI will run before deployment.");
  } else throw new Error("Unknown CI command.");
}

if (import.meta.main) {
  try { await main(process.argv[2] ?? ""); }
  catch { console.error("CI orchestration failed; deployment must not proceed."); process.exitCode = 1; }
}
