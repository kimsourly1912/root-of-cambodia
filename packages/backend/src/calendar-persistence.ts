import { assertion, operate, verifiedSQL, type Actor } from "./operations";
import type { CalendarEdit } from "./calendar";
export function commitRoomCalendar(
  db: D1Database,
  actor: Actor,
  key: string,
  propertyId: string,
  roomId: string,
  fields: CalendarEdit,
) {
  return operate(
    db,
    actor,
    key,
    { kind: "room_calendar", propertyId, roomId, fields },
    (op) => [
      assertion(
        db,
        op,
        `${verifiedSQL} AND EXISTS(SELECT 1 FROM room_type r JOIN property p ON p.id=r.property_id JOIN place l ON l.id=p.id WHERE r.id=? AND p.id=? AND p.owner_id=? AND l.publication='draft' AND r.revision=?)`,
        [actor.id, roomId, propertyId, actor.id, fields.roomRevision],
      ),
      ...fields.nights.flatMap((n) => [
        // Explicit absence is versioned too: another creator must not be silently overwritten.
        assertion(
          db,
          op,
          `((? IS NULL AND NOT EXISTS(SELECT 1 FROM inventory_night WHERE room_type_id=? AND night=?)) OR EXISTS(SELECT 1 FROM inventory_night WHERE room_type_id=? AND night=? AND revision=?)) AND
 ((? IS NULL AND NOT EXISTS(SELECT 1 FROM nightly_rate WHERE room_type_id=? AND night=?)) OR EXISTS(SELECT 1 FROM nightly_rate WHERE room_type_id=? AND night=? AND revision=?))`,
          [
            n.inventoryRevision,
            roomId,
            n.night,
            roomId,
            n.night,
            n.inventoryRevision,
            n.rateRevision,
            roomId,
            n.night,
            roomId,
            n.night,
            n.rateRevision,
          ],
        ),
        // Never assign reserved: booking transitions alone control that counter.
        db
          .prepare(
            "INSERT INTO inventory_night(room_type_id,night,capacity,blocked) VALUES (?,?,?,?) ON CONFLICT(room_type_id,night) DO UPDATE SET capacity=excluded.capacity,blocked=excluded.blocked",
          )
          .bind(roomId, n.night, n.capacity, n.blocked),
        db
          .prepare(
            "INSERT INTO nightly_rate(room_type_id,night,unit_cents) VALUES (?,?,?) ON CONFLICT(room_type_id,night) DO UPDATE SET unit_cents=excluded.unit_cents",
          )
          .bind(roomId, n.night, n.unitCents),
        db
          .prepare(
            `INSERT INTO room_calendar_event(operation_id,room_type_id,night,actor_id,capacity,blocked,reserved,unit_cents,inventory_revision,rate_revision,room_revision)
 SELECT ?,i.room_type_id,i.night,?,i.capacity,i.blocked,i.reserved,n.unit_cents,i.revision,n.revision,r.revision
 FROM inventory_night i JOIN nightly_rate n ON n.room_type_id=i.room_type_id AND n.night=i.night JOIN room_type r ON r.id=i.room_type_id WHERE i.room_type_id=? AND i.night=?`,
          )
          .bind(op, actor.id, roomId, n.night),
      ]),
      db
        .prepare(
          "UPDATE operation SET result_json=(SELECT json_object('id',?,'status','updated') WHERE (SELECT count(*) FROM room_calendar_event WHERE operation_id=?)=?) WHERE id=?",
        )
        .bind(roomId, op, fields.nights.length, op),
    ],
    "owner",
  );
}
