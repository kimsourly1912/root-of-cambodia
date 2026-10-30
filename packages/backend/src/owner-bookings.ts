import { DomainError } from "./errors";
import { verified, digest, type Actor, type Receipt } from "./operations";
import {
  readBooking,
  requireBookingActor,
  requireOwnedProperty,
} from "./access";
import { bookingCursor } from "./guest-bookings";
import {
  acceptancePreview,
  prepareAcceptance,
  logisticsDetails,
  type AcceptancePreview,
} from "./booking-logistics";
import { transition } from "./bookings";
export async function ownerBookings(
  db: D1Database,
  actor: Actor,
  propertyId: string,
  cursor?: unknown,
) {
  await verified(db, actor);
  await requireOwnedProperty(db, actor, propertyId);
  const c = bookingCursor(cursor);
  const rows = (
    await db
      .prepare(
        `SELECT b.id,b.property_name AS propertyName,b.guest_name AS guestName,b.status,b.checkin_date AS checkinDate,b.checkout_date AS checkoutDate,b.total_cents AS totalCents,b.submitted_at AS submittedAt,b.expires_at AS expiresAt FROM booking b JOIN property p ON p.id=b.property_id JOIN user u ON u.id=p.owner_id AND u.emailVerified=1 WHERE p.id=? AND p.owner_id=? AND b.status!='building' AND (? IS NULL OR b.submitted_at<? OR (b.submitted_at=? AND b.id<?)) ORDER BY b.submitted_at DESC,b.id DESC LIMIT 21`,
      )
      .bind(
        propertyId,
        actor.id,
        c?.time ?? null,
        c?.time ?? null,
        c?.time ?? null,
        c?.id ?? null,
      )
      .all<{
        id: string;
        propertyName: string;
        guestName: string;
        status: string;
        checkinDate: string;
        checkoutDate: string;
        totalCents: number;
        submittedAt: number;
        expiresAt: number;
      }>()
  ).results;
  const items = rows.slice(0, 20),
    last = items.at(-1);
  return {
    items,
    nextCursor:
      rows.length > 20 && last ? `${last.submittedAt}:${last.id}` : null,
  };
}
export async function ownerBooking(
  db: D1Database,
  actor: Actor,
  propertyId: string,
  id: string,
) {
  await verified(db, actor);
  await requireBookingActor(db, actor, id, false);
  const b = await readBooking(db, actor, id);
  if (b.propertyId !== propertyId) throw new DomainError("not_found", 404);
  const copy = await db
    .prepare(
      `SELECT b.status,a.details_json,a.accepted_at FROM booking b JOIN property p ON p.id=b.property_id JOIN user u ON u.id=p.owner_id AND u.emailVerified=1 LEFT JOIN booking_acceptance a ON a.booking_id=b.id WHERE b.id=? AND p.owner_id=?`,
    )
    .bind(id, actor.id)
    .first<{
      status: string;
      details_json: string | null;
      accepted_at: number | null;
    }>();
  if (!copy) throw new DomainError("not_found", 404);
  const saved = copy.details_json
    ? { ...logisticsDetails(copy.details_json), acceptedAt: copy.accepted_at! }
    : null;
  return {
    id: b.id,
    propertyId: b.propertyId,
    propertyName: b.propertyName,
    status: copy.status,
    guestName: b.guestName,
    guestEmail: b.guestEmail,
    source: b.source,
    checkinDate: b.checkinDate,
    checkoutDate: b.checkoutDate,
    checkinAt: b.checkinAt,
    checkoutAt: b.checkoutAt,
    expiresAt: b.expiresAt,
    totalCents: b.totalCents,
    policyText: b.policyText,
    cancellationText: b.cancellationText,
    termsVersion: b.termsVersion,
    lines: b.lines.map((l) => ({
      id: String(l.id),
      roomName: String(l.room_name),
      quantity: Number(l.quantity),
      adults: Number(l.adults),
      children: Number(l.children),
      night: String(l.night),
      unitCents: Number(l.unit_cents),
    })),
    charges: b.charges.map((c) => ({
      label: String(c.label),
      amountCents: Number(c.amount_cents),
    })),
    events: b.events.map((e) => ({
      kind: String(e.kind),
      actorRole: String(e.actor_role),
      occurredAt: Number(e.occurred_at),
      reason: e.reason === null ? null : String(e.reason),
    })),
    saved,
    preview:
      copy.status === "pending" ? await acceptancePreview(db, actor, id) : null,
  };
}
export type OwnerBooking = Awaited<ReturnType<typeof ownerBooking>>;
type OwnerAction = "accept" | "decline" | "cancel_owner";
type Attempt = {
  id: string;
  booking_id: string;
  actor_id: string;
  action: OwnerAction;
  reason: string | null;
  acceptance_hash: string | null;
  preview_json: string | null;
  fingerprint: string;
};
const key = (id: string) => "owner-response:" + id;
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
async function readAttempt(
  db: D1Database,
  actor: Actor,
  bookingId: string,
  id: string,
) {
  await verified(db, actor);
  await requireBookingActor(db, actor, bookingId, false);
  if (!uuid.test(id)) throw new DomainError("not_found", 404);
  const row = await db
    .prepare(
      "SELECT a.* FROM owner_booking_attempt a JOIN booking b ON b.id=a.booking_id JOIN property p ON p.id=b.property_id JOIN user u ON u.id=p.owner_id AND u.emailVerified=1 WHERE a.id=? AND a.booking_id=? AND a.actor_id=? AND p.owner_id=a.actor_id",
    )
    .bind(id, bookingId, actor.id)
    .first<Attempt>();
  if (!row) throw new DomainError("not_found", 404);
  return row;
}
export async function saveOwnerAttempt(
  db: D1Database,
  actor: Actor,
  bookingId: string,
  id: string,
  raw: Record<string, unknown>,
) {
  await verified(db, actor);
  await requireBookingActor(db, actor, bookingId, false);
  if (
    !uuid.test(id) ||
    Object.keys(raw).some(
      (k) => !["action", "reason", "acceptanceHash"].includes(k),
    ) ||
    !["accept", "decline", "cancel_owner"].includes(String(raw.action)) ||
    (raw.reason !== undefined && typeof raw.reason !== "string")
  )
    throw new DomainError("invalid_request", 422);
  const action = raw.action as OwnerAction,
    reason = typeof raw.reason === "string" ? raw.reason.trim() || null : null;
  if (reason && reason.length > 2000)
    throw new DomainError("invalid_reason", 422);
  if (action === "cancel_owner" && !reason)
    throw new DomainError("owner_reason_required", 422);
  const hash =
    action === "accept" && typeof raw.acceptanceHash === "string"
      ? raw.acceptanceHash
      : null;
  if (action === "accept" && (!hash || !/^[a-f0-9]{64}$/.test(hash)))
    throw new DomainError("acceptance_preview_required", 422);
  const fingerprint = await digest({
    bookingId,
    action,
    reason,
    acceptanceHash: hash,
  });
  const old = await db
    .prepare(
      "SELECT actor_id,booking_id,fingerprint FROM owner_booking_attempt WHERE id=?",
    )
    .bind(id)
    .first<Attempt>();
  if (old) {
    if (old.actor_id !== actor.id || old.booking_id !== bookingId)
      throw new DomainError("not_found", 404);
    if (old.fingerprint !== fingerprint)
      throw new DomainError("idempotency_conflict");
    return { id, status: "ready" };
  }
  const preview =
    action === "accept"
      ? await prepareAcceptance(db, actor, bookingId, hash!)
      : null;
  const payload = {
    kind: action,
    id: bookingId,
    reason,
    ...(action === "accept" ? { acceptanceHash: hash } : {}),
  };
  const operationFingerprint = await digest({ role: "owner", payload });
  await db
    .prepare(
      "INSERT INTO owner_booking_attempt(id,actor_id,booking_id,action,reason,acceptance_hash,preview_json,fingerprint,operation_fingerprint) VALUES (?,?,?,?,?,?,?,?,?) ON CONFLICT(id) DO NOTHING",
    )
    .bind(
      id,
      actor.id,
      bookingId,
      action,
      reason,
      hash,
      preview ? JSON.stringify(preview) : null,
      fingerprint,
      operationFingerprint,
    )
    .run();
  const saved = await readAttempt(db, actor, bookingId, id);
  if (saved.fingerprint !== fingerprint)
    throw new DomainError("idempotency_conflict");
  return { id, status: "ready" };
}
export async function ownerAttempt(
  db: D1Database,
  actor: Actor,
  bookingId: string,
  id: string,
) {
  const value = await readAttempt(db, actor, bookingId, id);
  const receipt = await db
    .prepare("SELECT result_json FROM operation WHERE principal=? AND key=?")
    .bind("user:" + actor.id, key(id))
    .first<{ result_json: string | null }>();
  return {
    id,
    action: value.action,
    reason: value.reason,
    preview: value.preview_json
      ? (JSON.parse(value.preview_json) as AcceptancePreview)
      : null,
    receipt: receipt?.result_json
      ? (JSON.parse(receipt.result_json) as Receipt)
      : null,
  };
}
export type OwnerAttempt = Awaited<ReturnType<typeof ownerAttempt>>;
export async function applyOwnerAttempt(
  db: D1Database,
  actor: Actor,
  bookingId: string,
  id: string,
) {
  const value = await readAttempt(db, actor, bookingId, id);
  return transition(
    db,
    actor,
    key(id),
    bookingId,
    value.action,
    value.reason ?? undefined,
    value.acceptance_hash ?? undefined,
  );
}
