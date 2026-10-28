// Infrastructure fixture: construct a historical Pending request through the same
// sealing trigger. No endpoint can backdate submitted_at or supply its own expiry.
export async function historical(
  db: D1Database,
  original: string,
  expiresSQL: string,
) {
  const id = crypto.randomUUID(),
    op = crypto.randomUUID();
  const columns = (
    await db.prepare("PRAGMA table_info(booking)").all<{ name: string }>()
  ).results.map((c) => c.name);
  const overrides: Record<string, string> = {
    id: "?",
    status: "'building'",
    submitted_at: "(" + expiresSQL + ")-43200",
    expires_at: expiresSQL,
    last_operation_id: "?",
  };
  await db.batch([
    db
      .prepare(
        "INSERT INTO operation(id,principal,actor_id,key,fingerprint,kind,actor_role) VALUES (?,'user:guest','guest',?,'historical-fixture','submit','guest')",
      )
      .bind(op, op),
    db
      .prepare(
        "INSERT INTO booking(" +
          columns.join(",") +
          ") SELECT " +
          columns.map((c) => overrides[c] ?? c).join(",") +
          " FROM booking WHERE id=?",
      )
      .bind(id, op, original),
    db
      .prepare(
        "INSERT INTO booking_line SELECT id||?, ?,property_id,room_type_id,room_name,quantity,adults,children,adult_capacity,child_capacity,total_capacity FROM booking_line WHERE booking_id=?",
      )
      .bind(id, id, original),
    db
      .prepare(
        "INSERT INTO booking_night SELECT n.line_id||?,n.night,n.unit_cents FROM booking_night n JOIN booking_line l ON l.id=n.line_id WHERE l.booking_id=?",
      )
      .bind(id, original),
    db
      .prepare(
        "INSERT INTO booking_charge SELECT ?,code,label,amount_cents FROM booking_charge WHERE booking_id=?",
      )
      .bind(id, original),
    db.prepare("UPDATE booking SET status='pending' WHERE id=?").bind(id),
  ]);
  return id;
}
