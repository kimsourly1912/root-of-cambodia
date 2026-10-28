import { access, writeFile } from "node:fs/promises";
import { randomBytes } from "node:crypto";
import { spawnSync } from "node:child_process";
import { getPlatformProxy } from "wrangler";
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
    "node_modules/wrangler/bin/wrangler.js",
    "d1",
    "migrations",
    "apply",
    "DB",
    "--local",
  ],
  { stdio: "inherit", windowsHide: true },
);
if (result.status !== 0) throw new Error("Local migration failed");
const proxy = await getPlatformProxy({
  configPath: "wrangler.jsonc",
  remoteBindings: false,
});
try {
  await proxy.env.DB.prepare(
    "CREATE TABLE IF NOT EXISTS local_email(id TEXT PRIMARY KEY,recipient TEXT NOT NULL,kind TEXT NOT NULL,url TEXT NOT NULL)",
  ).run();
} finally {
  await proxy.dispose();
}
