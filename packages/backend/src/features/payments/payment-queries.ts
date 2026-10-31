import { verified, type Actor } from "../../shared/index";
import { DomainError } from "../../shared/index";
export function paymentSummary(
  total: number,
  recordedAt: number | null,
  changedAt: number | null,
) {
  return {
    status:
      total === 0
        ? "no_payment_due"
        : recordedAt !== null
          ? "recorded"
          : "not_recorded",
    amountCents: recordedAt !== null ? total : 0,
    recordedAt,
    changedAt,
  };
}
export async function ownerPayments(
  db: D1Database,
  actor: Actor,
  id: string,
  cursor?: unknown,
) {
  await verified(db, actor);
  if (
    cursor !== undefined &&
    (typeof cursor !== "string" ||
      !/^\d{1,10}$/.test(cursor) ||
      Number(cursor) < 1)
  )
    throw new DomainError("invalid_request", 422);
  const current = await db
    .prepare(
      `SELECT b.total_cents,b.status,coalesce(s.revision,0) AS revision,a.occurred_at AS recordedAt,e.occurred_at AS changedAt FROM booking b JOIN property p ON p.id=b.property_id JOIN user u ON u.id=p.owner_id AND u.emailVerified=1 LEFT JOIN booking_payment_state s ON s.booking_id=b.id LEFT JOIN booking_payment_event a ON a.id=s.active_event_id LEFT JOIN booking_payment_event e ON e.id=s.last_event_id WHERE b.id=? AND b.status!='building' AND p.owner_id=?`,
    )
    .bind(id, actor.id)
    .first<{
      total_cents: number;
      status: string;
      revision: number;
      recordedAt: number | null;
      changedAt: number | null;
    }>();
  if (!current) throw new DomainError("not_found", 404);
  const events = (
    await db
      .prepare(
        `SELECT e.kind,e.amount_cents AS amountCents,e.revision,e.reason,e.occurred_at AS occurredAt FROM booking_payment_event e JOIN booking b ON b.id=e.booking_id JOIN property p ON p.id=b.property_id JOIN user u ON u.id=p.owner_id AND u.emailVerified=1 WHERE e.booking_id=? AND p.owner_id=? AND (? IS NULL OR e.revision<?) ORDER BY e.revision DESC LIMIT 21`,
      )
      .bind(
        id,
        actor.id,
        cursor === undefined ? null : Number(cursor),
        cursor === undefined ? null : Number(cursor),
      )
      .all<{
        kind: string;
        amountCents: number;
        revision: number;
        reason: string | null;
        occurredAt: number;
      }>()
  ).results;
  const drafts = (
    await db
      .prepare(
        `SELECT a.id,a.action FROM booking_payment_attempt a JOIN booking b ON b.id=a.booking_id JOIN property p ON p.id=b.property_id JOIN user u ON u.id=p.owner_id AND u.emailVerified=1 WHERE a.booking_id=? AND a.actor_id=? AND p.owner_id=a.actor_id AND NOT EXISTS(SELECT 1 FROM operation o WHERE o.principal='user:'||a.actor_id AND o.key='payment:'||a.id AND o.result_json IS NOT NULL) ORDER BY a.created_at DESC,a.id DESC LIMIT 5`,
      )
      .bind(id, actor.id)
      .all<{ id: string; action: string }>()
  ).results;
  const items = events.slice(0, 20);
  return {
    ...paymentSummary(
      current.total_cents,
      current.recordedAt,
      current.changedAt,
    ),
    revision: current.revision,
    totalCents: current.total_cents,
    bookingStatus: current.status,
    events: items,
    nextCursor: events.length > 20 ? String(items.at(-1)!.revision) : null,
    drafts,
  };
}
export type OwnerPayments = Awaited<ReturnType<typeof ownerPayments>>;
export type PaymentAttemptRow = {
  id: string;
  action: "record" | "void";
  expected_revision: number;
  reason: string | null;
  fingerprint: string;
};
export async function paymentAttemptRow(
  db: D1Database,
  actor: Actor,
  bookingId: string,
  id: string,
) {
  await verified(db, actor);
  if (
    !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/.test(id)
  )
    throw new DomainError("not_found", 404);
  const row = await db
    .prepare(
      "SELECT a.* FROM booking_payment_attempt a JOIN booking b ON b.id=a.booking_id JOIN property p ON p.id=b.property_id JOIN user u ON u.id=p.owner_id AND u.emailVerified=1 WHERE a.id=? AND a.booking_id=? AND a.actor_id=? AND p.owner_id=a.actor_id",
    )
    .bind(id, bookingId, actor.id)
    .first<PaymentAttemptRow>();
  if (!row) throw new DomainError("not_found", 404);
  return row;
}
