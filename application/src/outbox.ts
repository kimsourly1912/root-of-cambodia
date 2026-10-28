// Queue bodies contain an opaque ID only. Booking records remain the source of truth.
export type Publication = {
  send: (message: { id: string }) => Promise<unknown>;
};
export type Delivery = {
  id: string;
  bookingId: string;
  kind: string;
  email: string;
};
export type Provider = {
  send: (
    message: Delivery,
    options: { idempotencyKey: string },
  ) => Promise<{ id: string }>;
};
export async function publishDue(
  db: D1Database,
  queue: Publication,
  limit = 50,
) {
  const rows = await db
    .prepare(
      "SELECT id FROM notification_outbox WHERE (state='pending' AND due_at<=unixepoch()) OR (state='sending' AND lease_until<=unixepoch()) ORDER BY due_at,id LIMIT ?",
    )
    .bind(Math.max(1, Math.min(100, limit)))
    .all<{ id: string }>();
  // No published bit: until delivery claims the record, a later sweep republishes it.
  // This recovers enqueue timeouts, process death and messages missed after publication.
  for (const row of rows.results) await queue.send({ id: row.id });
  return rows.results.length;
}
export async function deliver(db: D1Database, id: string, provider: Provider) {
  const token = crypto.randomUUID();
  const results = await db.batch([
    db
      .prepare(
        "UPDATE notification_outbox SET state='sending',lease_token=?,lease_until=unixepoch()+300,attempts=attempts+1 WHERE id=? AND ((state='pending' AND due_at<=unixepoch()) OR (state='sending' AND lease_until<=unixepoch())) RETURNING id",
      )
      .bind(token, id),
    db
      .prepare(
        "INSERT INTO delivery_attempt(outbox_id,attempt,token,outcome) SELECT id,attempts,?,'started' FROM notification_outbox WHERE id=? AND lease_token=? AND state='sending'",
      )
      .bind(token, id, token),
  ]);
  if (!results[0].results.length) return { claimed: false };
  const message = await db
    .prepare(
      "SELECT o.id,e.booking_id AS bookingId,e.kind,u.email FROM notification_outbox o JOIN booking_event e ON e.id=o.event_id JOIN user u ON u.id=o.recipient_id WHERE o.id=? AND o.lease_token=? AND u.emailVerified=1",
    )
    .bind(id, token)
    .first<Delivery>();
  let sent: { id: string } | undefined;
  try {
    if (!message) throw new Error("recipient_unavailable");
    sent = await provider.send(message, { idempotencyKey: id });
  } catch {
    // No raw provider error or guest content in durable logs. A missing verified
    // recipient also remains recoverable rather than silently dropping the event.
    await db.batch([
      db
        .prepare(
          "UPDATE delivery_attempt SET outcome='retry',finished_at=unixepoch(),error_code=? WHERE token=? AND outcome='started'",
        )
        .bind(message ? "provider_retry" : "recipient_unavailable", token),
      db
        .prepare(
          "UPDATE notification_outbox SET state='pending',due_at=unixepoch()+min(3600,30*(1 << min(attempts,6))),lease_token=NULL,lease_until=NULL WHERE id=? AND lease_token=? AND state='sending'",
        )
        .bind(id, token),
    ]);
    return { claimed: true, delivered: false };
  }
  // If this commit times out, do not mark a provider success as a definite failure.
  // Lease expiry recovers it; every attempt reuses the stable provider key.
  await db.batch([
    db
      .prepare(
        "UPDATE delivery_attempt SET outcome='delivered',finished_at=unixepoch(),provider_id=? WHERE token=? AND outcome='started'",
      )
      .bind(sent.id, token),
    db
      .prepare(
        "UPDATE notification_outbox SET state='delivered',delivered_at=unixepoch(),provider_id=?,lease_token=NULL,lease_until=NULL WHERE id=? AND lease_token=? AND state='sending'",
      )
      .bind(sent.id, id, token),
  ]);
  return { claimed: true, delivered: true };
}
