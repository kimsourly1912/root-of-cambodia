import path from "node:path";
import { fileURLToPath } from "node:url";
import { createRequire } from "node:module";
import { handoffLocal } from "../../../scripts/handoff-local.ts";
import { access, writeFile } from "node:fs/promises";
import { randomBytes } from "node:crypto";
import { spawnSync } from "node:child_process";
import { getPlatformProxy } from "wrangler";
const root = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "../../..",
);
await handoffLocal(root);
const state = path.join(root, ".wrangler/state");
const require = createRequire(import.meta.url);
const wrangler = path.join(
  path.dirname(require.resolve("wrangler/package.json")),
  "bin/wrangler.js",
);
try {
  await access(".dev.vars");
} catch {
  await writeFile(
    ".dev.vars",
    "BETTER_AUTH_SECRET=" + randomBytes(32).toString("hex") + "\n",
    { flag: "wx" },
  );
}
const result = spawnSync(
  process.execPath,
  [
    wrangler,
    "d1",
    "migrations",
    "apply",
    "DB",
    "--local",
    "--persist-to",
    state,
  ],
  { stdio: "inherit", windowsHide: true },
);
if (result.status !== 0) throw new Error("Local migration failed");
// wrangler d1/dev append v3 to --persist-to; getPlatformProxy uses the path as given.
const proxy = await getPlatformProxy({
  configPath: "wrangler.jsonc",
  remoteBindings: false,
  persist: { path: path.join(state, "v3") },
});
try {
  await proxy.env.DB.prepare(
    "CREATE TABLE IF NOT EXISTS local_email(id TEXT PRIMARY KEY,recipient TEXT NOT NULL,kind TEXT NOT NULL,url TEXT NOT NULL)",
  ).run();
  await proxy.env.DB.prepare(
    "CREATE TABLE IF NOT EXISTS local_notification(id TEXT PRIMARY KEY,booking_id TEXT NOT NULL,kind TEXT NOT NULL,recipient TEXT NOT NULL)",
  ).run();
} finally {
  await proxy.dispose();
}
