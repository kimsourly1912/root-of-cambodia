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

// Configures the pilot publication setting and grants the reviewer platform
// admin (ADR 0010), as the trusted operator commands do. Upgrade tests that
// stop before 0021 get the setting only; that migration backfills the grant.
export async function configureReviewer(
  db: D1Database,
  reviewer: string,
  terms: string | null = null,
) {
  const staff = await db
    .prepare("SELECT 1 ok FROM sqlite_master WHERE type='table' AND name='platform_staff'")
    .first();
  if (!staff) {
    await db.prepare("INSERT INTO pilot_publication_config VALUES(1,?,?,1)").bind(reviewer, terms).run();
    return;
  }
  await db.batch([
    db.prepare("INSERT INTO pilot_publication_config VALUES(1,?,?,1)").bind(reviewer, terms),
    ...grantAdminStatements(db, reviewer),
  ]);
}
export function grantAdminStatements(db: D1Database, userId: string, active = true) {
  return [
    db
      .prepare(
        "INSERT INTO platform_staff_event(user_id,action,revision,operator,reason) SELECT ?,?,coalesce(max(revision),0)+1,'test','Test fixture' FROM platform_staff_event WHERE user_id=?",
      )
      .bind(userId, active ? "grant" : "revoke", userId),
    // Separate update and insert: SQLite runs BEFORE INSERT triggers ahead of
    // upsert conflict handling, so an upsert would trip the first-grant guard.
    db
      .prepare(
        "UPDATE platform_staff SET active=?,revision=(SELECT max(revision) FROM platform_staff_event WHERE user_id=?) WHERE user_id=?",
      )
      .bind(active ? 1 : 0, userId, userId),
    db
      .prepare(
        "INSERT INTO platform_staff(user_id,role,active,revision) SELECT ?,'admin',?,1 WHERE NOT EXISTS(SELECT 1 FROM platform_staff WHERE user_id=?)",
      )
      .bind(userId, active ? 1 : 0, userId),
  ];
}
