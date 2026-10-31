import { verified, digest, type Actor, type Receipt } from "../../shared/index";
import { requireBookingActor } from "../../shared/index";
import { DomainError } from "../../shared/index";
import { ownerPayments, paymentAttemptRow } from "./payment-queries";
import {
  commitPayment,
  persistPaymentAttempt,
  paymentPayload,
  type PaymentInput,
} from "./payment-persistence";
export function paymentInput(raw: unknown): PaymentInput {
  if (!raw || typeof raw !== "object" || Array.isArray(raw))
    throw new DomainError("invalid_payment", 422);
  const r = raw as Record<string, unknown>;
  if (
    Object.keys(r).some((k) => !["action", "revision", "reason"].includes(k)) ||
    (r.action !== "record" && r.action !== "void") ||
    !Number.isSafeInteger(r.revision) ||
    typeof r.revision !== "number" ||
    r.revision < 0 ||
    r.revision > 1e9 ||
    (r.reason !== undefined && typeof r.reason !== "string")
  )
    throw new DomainError("invalid_payment", 422);
  const reason = typeof r.reason === "string" ? r.reason.trim() || null : null;
  if (
    (reason && (reason.length > 2000 || reason.includes("\0"))) ||
    (r.action === "record" && reason) ||
    (r.action === "void" && !reason)
  )
    throw new DomainError("invalid_payment", 422);
  return { action: r.action, revision: r.revision, reason };
}
export async function changePayment(
  db: D1Database,
  actor: Actor,
  key: string,
  bookingId: string,
  raw: unknown,
) {
  await verified(db, actor);
  await requireBookingActor(db, actor, bookingId, false);
  return commitPayment(db, actor, key, bookingId, paymentInput(raw));
}
export async function preparePayment(
  db: D1Database,
  actor: Actor,
  bookingId: string,
  id: string,
  raw: unknown,
) {
  await verified(db, actor);
  await requireBookingActor(db, actor, bookingId, false);
  if (
    !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/.test(id)
  )
    throw new DomainError("invalid_payment", 422);
  const input = paymentInput(raw),
    fingerprint = await digest({ bookingId, input });
  const old = await db
    .prepare(
      "SELECT actor_id,booking_id,fingerprint FROM booking_payment_attempt WHERE id=?",
    )
    .bind(id)
    .first<{ actor_id: string; booking_id: string; fingerprint: string }>();
  if (old) {
    if (old.actor_id !== actor.id || old.booking_id !== bookingId)
      throw new DomainError("not_found", 404);
    if (old.fingerprint !== fingerprint)
      throw new DomainError("idempotency_conflict");
    return { id, status: "ready" };
  }
  const state = await ownerPayments(db, actor, bookingId);
  if (
    state.revision !== input.revision ||
    state.totalCents === 0 ||
    (input.action === "record" &&
      (!["checked_in", "completed"].includes(state.bookingStatus) ||
        state.status === "recorded")) ||
    (input.action === "void" && state.status !== "recorded")
  )
    throw new DomainError("booking_conflict");
  await persistPaymentAttempt(
    db,
    actor,
    bookingId,
    id,
    input,
    fingerprint,
    await digest({ role: "owner", payload: paymentPayload(bookingId, input) }),
  );
  const stored = await paymentAttemptRow(db, actor, bookingId, id);
  if (stored.fingerprint !== fingerprint)
    throw new DomainError("idempotency_conflict");
  return { id, status: "ready" };
}
export async function paymentAttempt(
  db: D1Database,
  actor: Actor,
  bookingId: string,
  id: string,
) {
  const row = await paymentAttemptRow(db, actor, bookingId, id);
  const result = await db
    .prepare("SELECT result_json FROM operation WHERE principal=? AND key=?")
    .bind("user:" + actor.id, "payment:" + id)
    .first<{ result_json: string | null }>();
  return {
    id,
    action: row.action,
    revision: row.expected_revision,
    reason: row.reason,
    receipt: result?.result_json
      ? (JSON.parse(result.result_json) as Receipt)
      : null,
  };
}
export type PaymentAttempt = Awaited<ReturnType<typeof paymentAttempt>>;
export async function applyPayment(
  db: D1Database,
  actor: Actor,
  bookingId: string,
  id: string,
) {
  const row = await paymentAttemptRow(db, actor, bookingId, id);
  return changePayment(db, actor, "payment:" + id, bookingId, {
    action: row.action,
    revision: row.expected_revision,
    ...(row.reason ? { reason: row.reason } : {}),
  });
}
