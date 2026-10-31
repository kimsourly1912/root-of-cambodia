import path from "node:path";
import { fileURLToPath } from "node:url";
import type { NextConfig } from "next";
import { initOpenNextCloudflareForDev } from "@opennextjs/cloudflare";
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
// `next dev` only: local bindings from the same state as preview:worker
// (wrangler appends v3 to --persist-to). Builds and deploys are unaffected.
if (process.env.NODE_ENV === "development")
  void initOpenNextCloudflareForDev({
    configPath: path.join(root, "apps/web/wrangler.jsonc"),
    remoteBindings: false,
    persist: { path: path.join(root, ".wrangler/state/v3") },
  });
const config: NextConfig = {
  outputFileTracingRoot: root,
  transpilePackages: ["@root-of-cambodia/backend"],
  poweredByHeader: false,
  // Agent guidance lives in the root AGENTS.md; do not generate a nested copy.
  agentRules: false,
  experimental: { cpus: 2 },
};
export default config;
