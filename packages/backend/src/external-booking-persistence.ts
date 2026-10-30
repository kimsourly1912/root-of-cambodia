import type { Actor } from "./operations";
import type { QuoteInput } from "./quotes";
export async function persistExternalReview(db: D1Database, actor: Actor, propertyId: string,
  id: string, fingerprint: string, input: QuoteInput, hash: string, preview: string, operationFingerprint: string) {
  await db.prepare("INSERT INTO external_booking_attempt(id,actor_id,property_id,fingerprint,input_json,quote_hash,preview_json,operation_fingerprint) VALUES(?,?,?,?,?,?,?,?) ON CONFLICT(id) DO NOTHING")
    .bind(id, actor.id, propertyId, fingerprint, JSON.stringify(input), hash, preview, operationFingerprint).run();
}
