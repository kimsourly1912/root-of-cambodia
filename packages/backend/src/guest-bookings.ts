import { DomainError } from "./errors";
import { verified, digest, type Actor, type Receipt } from "./operations";
import { publicStay } from "./catalog-queries";
import { quote, normalize, type Quote } from "./quotes";
import { submit } from "./bookings";
import { readBooking } from "./access";

const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
const operationKey = (id: string) => "guest-request:" + id;
export async function requestContext(db: D1Database, actor: Actor, id: string) {
  const user = await verified(db, actor);
  const listing = await publicStay(db, id);
  const terms = await db
    .prepare(
      `SELECT d.version,d.content FROM property p
    JOIN pilot_publication_config c ON c.singleton=1 AND c.terms_version=p.terms_version
    JOIN booking_terms_document d ON d.version=p.terms_version WHERE p.id=?`,
    )
    .bind(id)
    .first<{ version: string; content: string }>();
  if (!terms) throw new DomainError("booking_terms_unavailable", 422);
  if (!user.name.trim()) throw new DomainError("guest_name_required", 422);
  return { listing, terms, guestName: user.name };
}
function presentation(q: Quote, terms: { version: string; content: string }) {
  return {
    hash: q.hash,
    input: q.input,
    propertyName: q.property.name,
    totalCents: q.totalCents,
    currency: "USD" as const,
    checkinAt: q.checkinAt,
    checkoutAt: q.checkoutAt,
    terms,
    policy: {
      version: q.property.policy_version,
      text: q.property.policy_text,
    },
    cancellation:
      "Free guest cancellation before scheduled check-in. Encourage 24 hours notice; no platform fee.",
    charges: q.charges.map((c) => ({
      code: c.code,
      label: c.label,
      amountCents: c.amountCents,
    })),
    lines: q.lines.map((l) => ({
      selection: l.selection,
      roomName: l.room.name,
      rates: l.rates.map((r) => ({ night: r.night, unitCents: r.unit_cents })),
    })),
  };
}
export type GuestQuote = ReturnType<typeof presentation>;
export async function guestQuote(db: D1Database, actor: Actor, raw: unknown) {
  const input = normalize(raw);
  const context = await requestContext(db, actor, input.propertyId);
  if (context.terms.version !== input.termsVersion)
    throw new DomainError("terms_changed");
  if (
    input.lines.some(
      (l) => !context.listing.rooms.some((r) => r.id === l.roomId),
    )
  )
    throw new DomainError("room_unavailable");
  const q = await quote(db, actor, input);
  const clock = await db
    .prepare("SELECT unixepoch() AS now")
    .first<{ now: number }>();
  if (!clock || q.checkinAt < clock.now + 86400)
    throw new DomainError("lead_time_required", 422);
  // Recheck disclosure after the multi-query quote; browser DTO never includes internal property/user rows.
  await requestContext(db, actor, input.propertyId);
  return presentation(q, context.terms);
}
type AttemptRow = {
  id: string;
  guest_id: string;
  fingerprint: string;
  input_json: string;
  quote_hash: string;
  preview_json: string;
};
async function row(db: D1Database, actor: Actor, id: string) {
  await verified(db, actor);
  if (!uuid.test(id)) throw new DomainError("not_found", 404);
  const value = await db
    .prepare(
      "SELECT id,guest_id,fingerprint,input_json,quote_hash,preview_json FROM guest_booking_attempt WHERE id=? AND guest_id=?",
    )
    .bind(id, actor.id)
    .first<AttemptRow>();
  if (!value) throw new DomainError("not_found", 404);
  return value;
}
export async function saveGuestAttempt(
  db: D1Database,
  actor: Actor,
  id: string,
  raw: unknown,
  quoteHash: unknown,
) {
  await verified(db, actor);
  if (
    !uuid.test(id) ||
    typeof quoteHash !== "string" ||
    !/^[a-f0-9]{64}$/.test(quoteHash)
  )
    throw new DomainError("invalid_request", 422);
  const input = normalize(raw),
    fingerprint = await digest({ input, quoteHash });
  const previous = await db
    .prepare(
      "SELECT guest_id,fingerprint FROM guest_booking_attempt WHERE id=?",
    )
    .bind(id)
    .first<{ guest_id: string; fingerprint: string }>();
  if (previous) {
    if (previous.guest_id !== actor.id) throw new DomainError("not_found", 404);
    if (previous.fingerprint !== fingerprint)
      throw new DomainError("idempotency_conflict");
    return { id, status: "ready" };
  }
  const q = await guestQuote(db, actor, input);
  if (q.hash !== quoteHash) throw new DomainError("quote_changed");
  await db
    .prepare(
      "INSERT INTO guest_booking_attempt(id,guest_id,fingerprint,input_json,quote_hash,preview_json,terms_version) VALUES (?,?,?,?,?,?,?) ON CONFLICT(id) DO NOTHING",
    )
    .bind(
      id,
      actor.id,
      fingerprint,
      JSON.stringify({
        ...input,
        _operationFingerprint: await digest({
          role: "guest",
          payload: { kind: "submit", source: "online", input, quoteHash },
        }),
      }),
      quoteHash,
      JSON.stringify(q),
      input.termsVersion,
    )
    .run();
  const saved = await row(db, actor, id);
  if (saved.fingerprint !== fingerprint)
    throw new DomainError("idempotency_conflict");
  return { id, status: "ready" };
}
export async function guestAttempt(db: D1Database, actor: Actor, id: string) {
  const value = await row(db, actor, id);
  const receipt = await db
    .prepare(
      "SELECT result_json FROM operation WHERE principal=? AND key=? AND kind='submit'",
    )
    .bind("user:" + actor.id, operationKey(id))
    .first<{ result_json: string | null }>();
  return {
    id,
    preview: JSON.parse(value.preview_json) as GuestQuote,
    receipt: receipt?.result_json
      ? (JSON.parse(receipt.result_json) as Receipt)
      : null,
  };
}
export async function sendGuestAttempt(
  db: D1Database,
  actor: Actor,
  id: string,
  accepted: unknown,
) {
  const value = await row(db, actor, id);
  if (accepted !== true) throw new DomainError("booking_terms_required", 422);
  const input = JSON.parse(value.input_json);
  // A successful old receipt must replay even if today's listing/terms have changed.
  const committed = await db
    .prepare("SELECT result_json FROM operation WHERE principal=? AND key=?")
    .bind("user:" + actor.id, operationKey(id))
    .first<{ result_json: string | null }>();
  if (!committed?.result_json) await guestQuote(db, actor, input);
  return submit(db, actor, operationKey(id), input, value.quote_hash);
}

export function bookingCursor(value: unknown) {
  if (value === undefined || value === "") return null;
  if (
    typeof value !== "string" ||
    !/^\d{1,12}:[A-Za-z0-9_-]{1,128}$/.test(value)
  )
    throw new DomainError("invalid_request", 422);
  const [time, id] = value.split(":");
  return { time: Number(time), id };
}
export async function guestBookings(
  db: D1Database,
  actor: Actor,
  cursor?: unknown,
) {
  await verified(db, actor);
  const c = bookingCursor(cursor);
  const rows = (
    await db
      .prepare(
        `SELECT id,property_name AS propertyName,status,checkin_date AS checkinDate,checkout_date AS checkoutDate,total_cents AS totalCents,submitted_at AS submittedAt FROM booking
    WHERE guest_id=? AND source='online' AND status!='building' AND (? IS NULL OR submitted_at<? OR (submitted_at=? AND id<?)) ORDER BY submitted_at DESC,id DESC LIMIT 21`,
      )
      .bind(
        actor.id,
        c?.time ?? null,
        c?.time ?? null,
        c?.time ?? null,
        c?.id ?? null,
      )
      .all<{
        id: string;
        propertyName: string;
        status: string;
        checkinDate: string;
        checkoutDate: string;
        totalCents: number;
        submittedAt: number;
      }>()
  ).results;
  const items = rows.slice(0, 20),
    last = items.at(-1);
  const drafts = (
    await db
      .prepare(
        `SELECT a.id,json_extract(a.preview_json,'$.propertyName') AS propertyName FROM guest_booking_attempt a WHERE a.guest_id=? AND NOT EXISTS(SELECT 1 FROM operation o WHERE o.principal=? AND o.key='guest-request:'||a.id AND o.result_json IS NOT NULL) ORDER BY a.created_at DESC,a.id DESC LIMIT 5`,
      )
      .bind(actor.id, "user:" + actor.id)
      .all<{ id: string; propertyName: string }>()
  ).results;
  return {
    items,
    nextCursor:
      rows.length > 20 && last ? `${last.submittedAt}:${last.id}` : null,
    drafts,
  };
}
export async function guestBooking(db: D1Database, actor: Actor, id: string) {
  const b = await readBooking(db, actor, id);
  if (b.guestId !== actor.id || b.source !== "online")
    throw new DomainError("not_found", 404);
  return {
    id: b.id,
    propertyId: b.propertyId,
    propertyName: b.propertyName,
    status: b.status,
    checkinDate: b.checkinDate,
    checkoutDate: b.checkoutDate,
    checkinAt: b.checkinAt,
    checkoutAt: b.checkoutAt,
    submittedAt: b.submittedAt,
    expiresAt: b.expiresAt,
    totalCents: b.totalCents,
    currency: b.currency,
    policyText: b.policyText,
    termsVersion: b.termsVersion,
    cancellationText: b.cancellationText,
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
    logistics: null,
  };
}
export type GuestBooking = Awaited<ReturnType<typeof guestBooking>>;
