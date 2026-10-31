// Test preparation only. Production must explicitly preview and approve logistics.
import {
  transition as actualTransition,
  type Action,
} from "@root-of-cambodia/backend/bookings";
import { acceptancePreview } from "@root-of-cambodia/backend/bookings";
import {
  verified,
  operate,
  verifiedSQL,
  finish,
  type Actor,
} from "@root-of-cambodia/backend/shared";
import { requireBookingActor } from "@root-of-cambodia/backend/shared";
export async function ensureAcceptanceFixture(
  db: D1Database,
  propertyId: string,
) {
  await db
    .prepare(
      "INSERT INTO property_information(property_id,description_text,address_text,facilities_json) VALUES (?,'Synthetic fixture description','Synthetic fixture address','[]') ON CONFLICT(property_id) DO NOTHING",
    )
    .bind(propertyId)
    .run();
  await db
    .prepare(
      "INSERT INTO property_logistics(property_id,latitude,longitude,contact_name,contact_phone,contact_email,arrival_instructions) VALUES (?,NULL,NULL,'Fixture reception','','fixture@example.invalid','Synthetic fixture directions') ON CONFLICT(property_id) DO NOTHING",
    )
    .bind(propertyId)
    .run();
}
export async function testTransition(
  db: D1Database,
  actor: Actor,
  key: string,
  id: string,
  action: Action,
  reason?: string,
) {
  if (action !== "accept")
    return actualTransition(db, actor, key, id, action, reason);
  await verified(db, actor);
  await requireBookingActor(db, actor, id, false);
  const modern = await db
    .prepare(
      "SELECT name FROM sqlite_master WHERE type='table' AND name='booking_acceptance'",
    )
    .first();
  if (!modern) {
    // Construct authentic earlier-version acceptance data for populated migration tests.
    // This preserves the earlier payload/receipt; there is no runtime compatibility bypass.
    return operate(
      db,
      actor,
      key,
      { kind: "accept", id, reason: reason?.trim() || null },
      (op) => [
        db
          .prepare(
            "UPDATE booking SET status='confirmed',last_operation_id=?,reason=? WHERE id=? AND status='pending' AND expires_at>unixepoch() AND " +
              verifiedSQL +
              " AND EXISTS(SELECT 1 FROM property p WHERE p.id=booking.property_id AND p.owner_id=?)",
          )
          .bind(op, reason?.trim() || null, id, actor.id, actor.id),
        finish(db, op, id),
      ],
      "owner",
    );
  }
  const old = await db
    .prepare(
      "SELECT o.id,a.preview_hash FROM operation o LEFT JOIN booking_acceptance a ON a.operation_id=o.id WHERE o.principal=? AND o.key=?",
    )
    .bind("user:" + actor.id, key)
    .first<{ id: string; preview_hash: string | null }>();
  let hash: string | undefined = old?.preview_hash ?? undefined;
  if (!old) {
    const booking = await db
      .prepare("SELECT property_id FROM booking WHERE id=?")
      .bind(id)
      .first<{ property_id: string }>();
    if (booking) await ensureAcceptanceFixture(db, booking.property_id);
    hash = (await acceptancePreview(db, actor, id)).hash;
  }
  return actualTransition(db, actor, key, id, action, reason, hash);
}
