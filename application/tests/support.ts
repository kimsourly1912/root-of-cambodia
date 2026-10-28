import { env } from "cloudflare:workers";
import { applyD1Migrations, reset } from "cloudflare:test";
export * from "./fixtures";

// Preserve a fresh database per scenario, including after a failed assertion.
// File-level isolation alone would leak the immutable booking history between tests.
export async function migrate(db: D1Database, files?: string[]) {
  const migrations = files
    ? files.map((name) => {
        const migration = env.TEST_MIGRATIONS.find(
          (entry) => entry.name === name,
        );
        if (!migration)
          throw new Error("Missing upgrade fixture migration: " + name);
        return migration;
      })
    : env.TEST_MIGRATIONS;
  await applyD1Migrations(db, migrations);
}

export async function database(options: { migrate?: boolean } = {}) {
  await reset();
  const db = env.DB;
  if (options.migrate !== false) await migrate(db);
  return { db, dispose: reset };
}
