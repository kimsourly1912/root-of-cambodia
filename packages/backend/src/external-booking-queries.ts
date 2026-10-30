import { verified, type Actor, type Receipt } from "./operations";
import { requireOwnedProperty } from "./access";
import { DomainError } from "./errors";
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
export async function externalContext(db: D1Database, actor: Actor, propertyId: string) {
  await verified(db, actor);
  const p = await db.prepare("SELECT p.terms_version AS termsVersion FROM property p JOIN user u ON u.id=p.owner_id AND u.emailVerified=1 WHERE p.id=? AND p.owner_id=?")
    .bind(propertyId, actor.id).first<{termsVersion: string}>();
  if (!p) throw new DomainError("not_found", 404);
  return p;
}
export type ExternalReviewRow = {id: string; fingerprint: string; input_json: string; quote_hash: string; preview_json: string};
export async function externalReviewRow(db: D1Database, actor: Actor, propertyId: string, id: string) {
  await verified(db, actor);
  if (!uuid.test(id)) throw new DomainError("not_found", 404);
  const a = await db.prepare("SELECT a.id,a.fingerprint,a.input_json,a.quote_hash,a.preview_json FROM external_booking_attempt a JOIN property p ON p.id=a.property_id JOIN user u ON u.id=p.owner_id AND u.emailVerified=1 WHERE a.id=? AND a.property_id=? AND a.actor_id=? AND p.owner_id=a.actor_id")
    .bind(id, propertyId, actor.id).first<ExternalReviewRow>();
  if (!a) throw new DomainError("not_found", 404);
  return a;
}
export async function externalReceipt(db: D1Database, actor: Actor, propertyId: string, id: string) {
  await externalReviewRow(db, actor, propertyId, id);
  const r = await db.prepare("SELECT o.result_json FROM operation o JOIN external_booking_attempt a ON o.key=\'external-request:\'||a.id AND o.fingerprint=a.operation_fingerprint WHERE o.principal=? AND a.id=? AND a.actor_id=? AND a.property_id=?")
    .bind("user:" + actor.id, id, actor.id, propertyId).first<{result_json: string | null}>();
  return r?.result_json ? JSON.parse(r.result_json) as Receipt : null;
}
export async function externalReviews(db: D1Database, actor: Actor, propertyId: string) {
  await verified(db, actor); await requireOwnedProperty(db, actor, propertyId);
  return (await db.prepare("SELECT a.id FROM external_booking_attempt a JOIN property p ON p.id=a.property_id JOIN user u ON u.id=p.owner_id AND u.emailVerified=1 WHERE a.property_id=? AND a.actor_id=? AND p.owner_id=a.actor_id AND NOT EXISTS(SELECT 1 FROM operation o WHERE o.principal='user:'||a.actor_id AND o.key='external-request:'||a.id AND o.result_json IS NOT NULL) ORDER BY a.created_at DESC,a.id DESC LIMIT 5")
    .bind(propertyId, actor.id).all<{id: string}>()).results;
}
