// Test-only scoped database clock; no application route, binding or policy bypass.
export async function setStayClock(
  db: D1Database,
  id: string,
  instant: number,
) {
  if (!/^[0-9a-f-]{36}$/.test(id) || !Number.isSafeInteger(instant))
    throw new Error("Invalid fixture clock");
  await db
    .prepare(
      "CREATE TABLE IF NOT EXISTS _test_stay_clock(booking_id TEXT PRIMARY KEY,instant INTEGER NOT NULL)",
    )
    .run();
  const trigger = await db
    .prepare(
      "SELECT sql FROM sqlite_master WHERE type='trigger' AND name='booking_arrival_window'",
    )
    .first<{ sql: string }>();
  if (!trigger) throw new Error("Arrival guard missing in fixture database");
  if (!trigger.sql.includes("_test_stay_clock")) {
    await db.prepare("DROP TRIGGER booking_arrival_window").run();
    await db
      .prepare(
        trigger.sql.replaceAll(
          "unixepoch()",
          "coalesce((SELECT instant FROM _test_stay_clock WHERE booking_id=NEW.id),unixepoch())",
        ),
      )
      .run();
  }
  await db
    .prepare(
      "INSERT INTO _test_stay_clock VALUES (?,?) ON CONFLICT(booking_id) DO UPDATE SET instant=excluded.instant",
    )
    .bind(id, instant)
    .run();
}
export async function atScheduledArrival(db: D1Database, id: string) {
  const b = await db
    .prepare("SELECT checkin_at FROM booking WHERE id=?")
    .bind(id)
    .first<{ checkin_at: number }>();
  if (!b) throw new Error("Fixture booking missing");
  await setStayClock(db, id, b.checkin_at);
}
