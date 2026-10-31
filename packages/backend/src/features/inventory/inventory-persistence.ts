import { verifiedSQL, operate, type Actor } from "../../shared/index";
export type InventoryEdit = {
  roomId: string;
  night: string;
  capacity: number;
  blocked: number;
  revision: number;
};
// One versioned edit, attributable event and durable receipt commit together.
// Reserved counters remain controlled by booking transitions, never this API.
export async function editInventoryNight(
  db: D1Database,
  actor: Actor,
  key: string,
  input: InventoryEdit,
) {
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
