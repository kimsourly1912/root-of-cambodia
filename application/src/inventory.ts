import { DomainError } from "./errors";
import { verified, verifiedSQL, operate, type Actor } from "./operations";
export async function editInventory(
  db: D1Database,
  actor: Actor,
  key: string,
  raw: unknown,
) {
  if (!raw || typeof raw !== "object" || Array.isArray(raw))
    throw new DomainError("invalid_inventory", 422);
  const value = raw as Record<string, unknown>;
  if (
    typeof value.roomId !== "string" ||
    typeof value.night !== "string" ||
    typeof value.capacity !== "number" ||
    typeof value.blocked !== "number" ||
    typeof value.revision !== "number"
  )
    throw new DomainError("invalid_inventory", 422);
  const input = {
    roomId: value.roomId,
    night: value.night,
    capacity: value.capacity,
    blocked: value.blocked,
    revision: value.revision,
  };
  if (
    !/^\d{4}-\d{2}-\d{2}$/.test(input.night) ||
    !Number.isFinite(Date.parse(input.night)) ||
    new Date(input.night).toISOString().slice(0, 10) !== input.night ||
    input.revision < 1
  )
    throw new DomainError("invalid_inventory", 422);
  await verified(db, actor);
  if (
    ![input.capacity, input.blocked].every(
      (n) => Number.isInteger(n) && n >= 0 && n <= 10000,
    ) ||
    !Number.isSafeInteger(input.revision)
  )
    throw new DomainError("invalid_inventory", 422);
  const room = await db
    .prepare(
      "SELECT r.id FROM room_type r JOIN property p ON p.id=r.property_id WHERE r.id=? AND p.owner_id=?",
    )
    .bind(input.roomId, actor.id)
    .first();
  if (!room) throw new DomainError("not_found", 404);
  return operate(
    db,
    actor,
    key,
    { kind: "inventory", input },
    (op) => [
      db
        .prepare(
          "UPDATE inventory_night SET capacity=?,blocked=? WHERE room_type_id=? AND night=? AND revision=? AND " +
            verifiedSQL +
            " AND EXISTS(SELECT 1 FROM room_type r JOIN property p ON p.id=r.property_id WHERE r.id=inventory_night.room_type_id AND p.owner_id=?)",
        )
        .bind(
          input.capacity,
          input.blocked,
          input.roomId,
          input.night,
          input.revision,
          actor.id,
          actor.id,
        ),
      // changes() here is the direct UPDATE count, excluding revision-trigger side effects.
      db
        .prepare(
          "INSERT INTO inventory_event(operation_id,room_type_id,night,capacity,blocked,actor_id) SELECT ?,?,?,?,?,? WHERE changes()=1",
        )
        .bind(
          op,
          input.roomId,
          input.night,
          input.capacity,
          input.blocked,
          actor.id,
        ),
      db
        .prepare(
          "UPDATE operation SET result_json=(SELECT json_object('id',operation_id,'status','updated') FROM inventory_event WHERE operation_id=?) WHERE id=?",
        )
        .bind(op, op),
    ],
    "owner",
  );
}
