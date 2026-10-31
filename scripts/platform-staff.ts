// Trusted operator writes for platform admin grants (ADR 0010). Imported only by
// operator scripts and loopback test servers; the application never grants admin.
// The statements are idempotent: an account already in the requested state adds
// no event. Run them in one batch so the event and the staff row commit together.
export function adminChangeStatements(
  db: D1Database,
  userId: string,
  active: boolean,
  operator: string,
  reason: string,
) {
  const state = active ? 1 : 0;
  return [
    db
      .prepare(
        `INSERT INTO platform_staff_event(user_id,action,revision,operator,reason)
         SELECT ?,?,coalesce((SELECT max(revision) FROM platform_staff_event WHERE user_id=?),0)+1,?,?
         WHERE (SELECT active FROM platform_staff WHERE user_id=?) IS NOT ?
         AND (?=1 OR EXISTS(SELECT 1 FROM platform_staff WHERE user_id=?))`,
      )
      .bind(userId, active ? "grant" : "revoke", userId, operator, reason, userId, state, state, userId),
    // A separate update and insert: SQLite runs BEFORE INSERT triggers ahead of
    // upsert conflict handling, which would trip the first-grant guard.
    db
      .prepare(
        `UPDATE platform_staff SET active=?,revision=(SELECT max(revision) FROM platform_staff_event WHERE user_id=?)
         WHERE user_id=? AND revision<(SELECT max(revision) FROM platform_staff_event WHERE user_id=?)`,
      )
      .bind(state, userId, userId, userId),
    db
      .prepare(
        `INSERT INTO platform_staff(user_id,role,active,revision) SELECT ?,'admin',?,1
         WHERE NOT EXISTS(SELECT 1 FROM platform_staff WHERE user_id=?)
         AND EXISTS(SELECT 1 FROM platform_staff_event WHERE user_id=? AND revision=1)`,
      )
      .bind(userId, state, userId, userId),
  ];
}
