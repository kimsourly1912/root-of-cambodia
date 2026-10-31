import { operate, assertion, type Actor } from "../../shared/index";
export type PaymentInput = {
  action: "record" | "void";
  revision: number;
  reason: string | null;
};
export const paymentPayload = (id: string, input: PaymentInput) => ({
  kind: "payment_" + input.action,
  id,
  revision: input.revision,
  reason: input.reason,
});
export async function commitPayment(
  db: D1Database,
  actor: Actor,
  key: string,
  id: string,
  input: PaymentInput,
) {
  return operate(
    db,
    actor,
    key,
    paymentPayload(id, input),
    (op) => [
      ...(key.startsWith("payment:")
        ? [
            assertion(
              db,
              op,
              "EXISTS(SELECT 1 FROM booking_payment_attempt a JOIN operation o ON o.id=? AND o.principal='user:'||a.actor_id AND o.key='payment:'||a.id WHERE a.booking_id=? AND a.actor_id=? AND o.fingerprint=a.operation_fingerprint)",
              [op, id, actor.id],
            ),
          ]
        : []),
      db
        .prepare(
          `INSERT INTO booking_payment_event(id,booking_id,actor_id,kind,amount_cents,revision,voids_event_id,reason)
    SELECT ?,b.id,?,?,b.total_cents,?,CASE WHEN ?='void' THEN s.active_event_id ELSE NULL END,?
    FROM booking b LEFT JOIN booking_payment_state s ON s.booking_id=b.id WHERE b.id=? AND coalesce(s.revision,0)=?`,
        )
        .bind(
          op,
          actor.id,
          input.action,
          input.revision + 1,
          input.action,
          input.reason,
          id,
          input.revision,
        ),
      db
        .prepare(
          "UPDATE operation SET result_json=(SELECT json_object('id',booking_id,'status',CASE WHEN active_event_id IS NULL THEN 'not_recorded' ELSE 'recorded' END,'revision',revision) FROM booking_payment_state WHERE booking_id=? AND last_event_id=?) WHERE id=?",
        )
        .bind(id, op, op),
    ],
    "owner",
  );
}
export async function persistPaymentAttempt(
  db: D1Database,
  actor: Actor,
  bookingId: string,
  id: string,
  input: PaymentInput,
  fingerprint: string,
  operationFingerprint: string,
) {
  await db
    .prepare(
      "INSERT INTO booking_payment_attempt(id,booking_id,actor_id,action,expected_revision,reason,fingerprint,operation_fingerprint) VALUES (?,?,?,?,?,?,?,?) ON CONFLICT(id) DO NOTHING",
    )
    .bind(
      id,
      bookingId,
      actor.id,
      input.action,
      input.revision,
      input.reason,
      fingerprint,
      operationFingerprint,
    )
    .run();
}
