import { execFileSync } from "node:child_process";
import { readdir } from "node:fs/promises";
import { createRequire } from "node:module";
import path from "node:path";

const root = path.resolve(import.meta.dirname, "..");

export function assertStagingSchema(files: string[], output: unknown) {
  if (!Array.isArray(output) || output.length !== 1 ||
      output[0]?.success !== true || !Array.isArray(output[0]?.results)) {
    throw new Error("Could not verify staging migration tracking; deployment refused.");
  }
  const applied = output[0].results.map((row: { name?: unknown }) => row.name);
  if (applied.some((name: unknown) => typeof name !== "string") ||
      new Set(applied).size !== applied.length ||
      JSON.stringify([...files].sort()) !== JSON.stringify([...applied].sort())) {
    throw new Error("Staging schema differs from this commit. Review and apply migrations separately, then redeploy; no migration or reset was performed.");
  }
}

if (import.meta.main) {
  try {
    const require = createRequire(import.meta.url);
    const wrangler = path.join(path.dirname(require.resolve("wrangler/package.json")), "bin/wrangler.js");
    // Read only. Never apply migrations, seed data or read business records here.
    const output = execFileSync(process.execPath, [wrangler, "d1", "execute", "DB",
      "--env", "staging", "--remote", "--json", "--command",
      "SELECT name FROM d1_migrations ORDER BY name"], {
      cwd: path.join(root, "apps/web"), encoding: "utf8", maxBuffer: 1024 * 1024,
      stdio: ["ignore", "pipe", "pipe"],
    });
    const files = (await readdir(path.join(root, "packages/backend/migrations"))).filter(f => f.endsWith(".sql"));
    assertStagingSchema(files, JSON.parse(output));
    console.log("Staging migration tracking matches this commit. No schema/data writes performed.");
  } catch {
    // Raw CLI errors may contain provider data. Keep CI output bounded and safe.
    console.error("Staging schema check failed. Confirm D1 read permission and that all reviewed migrations match this commit. No migration/reset was performed; deployment refused.");
    process.exitCode = 1;
  }
}
