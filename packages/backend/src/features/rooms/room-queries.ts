import { verified, type Actor } from "../../shared/index";
import { requireOwnedProperty } from "../../shared/index";
import { DomainError } from "../../shared/index";
export type OwnerRoomType = {
  id: string;
  propertyId: string;
  name: string;
  adultCapacity: number;
  childCapacity: number;
  totalCapacity: number;
  revision: number;
  active: number;
};
const projection = `r.id,r.property_id AS propertyId,r.name,r.adult_capacity AS adultCapacity,r.child_capacity AS childCapacity,r.total_capacity AS totalCapacity,r.revision,r.active`;
export async function ownerRoomType(
  db: D1Database,
  actor: Actor,
  propertyId: string,
  id: string,
) {
  await verified(db, actor);
  const room = await db
    .prepare(
      `SELECT ${projection} FROM room_type r JOIN property p ON p.id=r.property_id WHERE r.id=? AND p.id=? AND p.owner_id=?`,
    )
    .bind(id, propertyId, actor.id)
    .first<OwnerRoomType>();
  if (!room) throw new DomainError("not_found", 404);
  return room;
}
export async function ownerRoomTypes(
  db: D1Database,
  actor: Actor,
  propertyId: string,
  cursor = "",
) {
  await verified(db, actor);
  await requireOwnedProperty(db, actor, propertyId);
  if (cursor.length > 128) throw new DomainError("invalid_request", 422);
  const rows = await db
    .prepare(
      `SELECT ${projection} FROM room_type r JOIN property p ON p.id=r.property_id WHERE p.id=? AND p.owner_id=? AND r.id>? ORDER BY r.id LIMIT 21`,
    )
    .bind(propertyId, actor.id, cursor)
    .all<OwnerRoomType>();
  const items = rows.results.slice(0, 20);
  return {
    items,
    nextCursor: rows.results.length > 20 ? items.at(-1)!.id : null,
  };
}
