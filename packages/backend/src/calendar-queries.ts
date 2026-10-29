import type { Actor } from "./operations";
import { ownerRoomType } from "./room-queries";
import { calendarWeek } from "./calendar-dates";
export type CalendarNight = {
  night: string;
  capacity: number | null;
  blocked: number | null;
  reserved: number | null;
  unitCents: number | null;
  inventoryRevision: number | null;
  rateRevision: number | null;
};
export async function ownerRoomCalendar(
  db: D1Database,
  actor: Actor,
  propertyId: string,
  roomId: string,
  start: string,
) {
  const room = await ownerRoomType(db, actor, propertyId, roomId);
  const days = calendarWeek(start);
  const rows = await db
    .prepare(
      `WITH dates(night) AS (VALUES ${days.map(() => "(?)").join(",")})
 SELECT d.night,i.capacity,i.blocked,i.reserved,n.unit_cents AS unitCents,i.revision AS inventoryRevision,n.revision AS rateRevision
 FROM dates d JOIN room_type r ON r.id=? JOIN property p ON p.id=r.property_id
 LEFT JOIN inventory_night i ON i.room_type_id=r.id AND i.night=d.night
 LEFT JOIN nightly_rate n ON n.room_type_id=r.id AND n.night=d.night
 WHERE p.id=? AND p.owner_id=? ORDER BY d.night`,
    )
    .bind(...days, roomId, propertyId, actor.id)
    .all<CalendarNight>();
  return { roomRevision: room.revision, nights: rows.results };
}
