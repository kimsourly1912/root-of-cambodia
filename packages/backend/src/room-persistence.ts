import { assertion, operate, verifiedSQL, type Actor } from "./operations";
import type { RoomTypeFields, RoomTypeEdit } from "./room-types";
const finish = (db: D1Database, op: string, status: "created" | "updated") =>
  db
    .prepare(
      "UPDATE operation SET result_json=(SELECT json_object('id',room_type_id,'status',?) FROM room_type_event WHERE operation_id=?) WHERE id=?",
    )
    .bind(status, op, op);
const draftOwner = `${verifiedSQL} AND EXISTS(SELECT 1 FROM property p JOIN place l ON l.id=p.id WHERE p.id=? AND p.owner_id=? AND l.publication='draft')`;
export function commitCreateRoomType(
  db: D1Database,
  actor: Actor,
  key: string,
  propertyId: string,
  fields: RoomTypeFields,
) {
  return operate(
    db,
    actor,
    key,
    { kind: "room_type_create", propertyId, fields },
    (op) => {
      const id = crypto.randomUUID();
      return [
        assertion(db, op, draftOwner, [actor.id, propertyId, actor.id]),
        db
          .prepare(
            "INSERT INTO room_type(id,property_id,name,adult_capacity,child_capacity,total_capacity) VALUES (?,?,?,?,?,?)",
          )
          .bind(
            id,
            propertyId,
            fields.name,
            fields.adultCapacity,
            fields.childCapacity,
            fields.totalCapacity,
          ),
        db
          .prepare(
            "INSERT INTO room_type_event(operation_id,room_type_id,actor_id,kind,revision) VALUES (?,?,?,'created',1)",
          )
          .bind(op, id, actor.id),
        finish(db, op, "created"),
      ];
    },
    "owner",
  );
}
export function commitUpdateRoomType(
  db: D1Database,
  actor: Actor,
  key: string,
  propertyId: string,
  id: string,
  fields: RoomTypeEdit,
) {
  return operate(
    db,
    actor,
    key,
    { kind: "room_type_update", propertyId, id, fields },
    (op) => [
      assertion(db, op, draftOwner, [actor.id, propertyId, actor.id]),
      // The existing revision_room_type trigger increments exactly once.
      db
        .prepare(
          "UPDATE room_type SET name=?,adult_capacity=?,child_capacity=?,total_capacity=? WHERE id=? AND property_id=? AND revision=?",
        )
        .bind(
          fields.name,
          fields.adultCapacity,
          fields.childCapacity,
          fields.totalCapacity,
          id,
          propertyId,
          fields.revision,
        ),
      assertion(db, op, "changes()=1"),
      db
        .prepare(
          "INSERT INTO room_type_event(operation_id,room_type_id,actor_id,kind,revision) VALUES (?,?,?,'updated',?)",
        )
        .bind(op, id, actor.id, fields.revision + 1),
      finish(db, op, "updated"),
    ],
    "owner",
  );
}
