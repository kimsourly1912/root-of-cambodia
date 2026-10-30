import { verified, digest, type Actor } from "./operations";
import { requireOwnedProperty } from "./access";
import { normalize, quote, type QuoteInput, type Quote } from "./quotes";
import { submit } from "./bookings";
import { DomainError } from "./errors";
import { externalContext, externalReviewRow, externalReceipt } from "./external-booking-queries";
import { persistExternalReview } from "./external-booking-persistence";
function selection(propertyId: string, raw: unknown) {
  if (!raw || typeof raw !== "object" || Array.isArray(raw) ||
      Object.keys(raw).some(k => !["checkin", "checkout", "lines"].includes(k)))
    throw new DomainError("invalid_request", 422);
  return normalize({...raw, propertyId, termsVersion: "selected-on-server"});
}
function presentation(q: Quote) {
  return {propertyName: q.property.name, input: q.input, totalCents: q.totalCents,
    currency: "USD" as const, checkinAt: q.checkinAt, checkoutAt: q.checkoutAt,
    policyText: q.property.policy_text, policyVersion: q.property.policy_version,
    charges: q.charges.map(c => ({label: c.label, amountCents: c.amountCents})),
    lines: q.lines.map(l => ({selection: l.selection, roomName: l.room.name,
      rates: l.rates.map(r => ({night: r.night, unitCents: r.unit_cents}))}))};
}
export type ExternalPreview = ReturnType<typeof presentation>;
export async function prepareExternalReview(db: D1Database, actor: Actor, propertyId: string, id: string, raw: unknown) {
  await verified(db, actor); await requireOwnedProperty(db, actor, propertyId);
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/.test(id))
    throw new DomainError("invalid_request", 422);
  const selected = selection(propertyId, raw), fingerprint = await digest(selected);
  const old = await db.prepare("SELECT actor_id,property_id,fingerprint FROM external_booking_attempt WHERE id=?")
    .bind(id).first<{actor_id: string; property_id: string; fingerprint: string}>();
  if (old) {
    if (old.actor_id !== actor.id || old.property_id !== propertyId) throw new DomainError("not_found", 404);
    if (old.fingerprint !== fingerprint) throw new DomainError("idempotency_conflict");
    return {id, status: "ready"};
  }
  const context = await externalContext(db, actor, propertyId);
  const input = {...selected, termsVersion: context.termsVersion};
  const q = await quote(db, actor, input, "external");
  const preview = JSON.stringify(presentation(q));
  if (new TextEncoder().encode(preview).length > 262144) throw new DomainError("request_size_limit", 422);
  await persistExternalReview(db, actor, propertyId, id, fingerprint, q.input, q.hash, preview,
    await digest({role: "owner", payload: {kind: "submit", source: "external", input: q.input, quoteHash: q.hash}}));
  const stored = await externalReviewRow(db, actor, propertyId, id);
  if (stored.fingerprint !== fingerprint) throw new DomainError("idempotency_conflict");
  return {id, status: "ready"};
}
export async function externalReview(db: D1Database, actor: Actor, propertyId: string, id: string) {
  const a = await externalReviewRow(db, actor, propertyId, id);
  return {id, preview: JSON.parse(a.preview_json) as ExternalPreview,
    receipt: await externalReceipt(db, actor, propertyId, id)};
}
export type ExternalReview = Awaited<ReturnType<typeof externalReview>>;
export async function applyExternalReview(db: D1Database, actor: Actor, propertyId: string, id: string, raw: unknown) {
  const a = await externalReviewRow(db, actor, propertyId, id);
  if (!raw || typeof raw !== "object" || Array.isArray(raw) ||
      Object.keys(raw).some(k => k !== "confirmed") || !("confirmed" in raw) || raw.confirmed !== true)
    throw new DomainError("confirmation_required", 422);
  return submit(db, actor, "external-request:" + id, JSON.parse(a.input_json) as QuoteInput, a.quote_hash, "external");
}
