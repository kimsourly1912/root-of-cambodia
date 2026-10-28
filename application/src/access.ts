import { and, eq, or, ne } from "drizzle-orm";
import { drizzle } from "drizzle-orm/d1";
import { bookings, properties } from "./schema";
import { verified, type Actor } from "./operations";
import { DomainError } from "./errors";
export async function readBooking(db: D1Database, actor: Actor, id: string) {
  await verified(db, actor);
  const rows = await drizzle(db)
    .select({ booking: bookings })
    .from(bookings)
    .innerJoin(properties, eq(properties.id, bookings.propertyId))
    .where(
      and(
        eq(bookings.id, id),
        ne(bookings.status, "building"),
        or(eq(bookings.guestId, actor.id), eq(properties.ownerId, actor.id)),
      ),
    )
    .limit(1);
  if (!rows.length) throw new DomainError("not_found", 404);
  const lines = await db
    .prepare(
      "SELECT l.*,n.night,n.unit_cents FROM booking_line l JOIN booking_night n ON n.line_id=l.id WHERE l.booking_id=? ORDER BY l.id,n.night",
    )
    .bind(id)
    .all();
  const charges = await db
    .prepare(
      "SELECT code,label,amount_cents FROM booking_charge WHERE booking_id=? ORDER BY code",
    )
    .bind(id)
    .all();
  const events = await db
    .prepare(
      "SELECT kind,actor_id,actor_role,occurred_at,reason FROM booking_event WHERE booking_id=? ORDER BY occurred_at,id",
    )
    .bind(id)
    .all();
  return {
    ...rows[0].booking,
    lines: lines.results,
    charges: charges.results,
    events: events.results,
  };
}
