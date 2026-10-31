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
      "SELECT kind,actor_id,actor_role,occurred_at,reason FROM booking_event WHERE booking_id=? ORDER BY occurred_at,rowid",
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

// Internal resource checks: services verify the actor first, including on receipt
// replay. These early checks do not replace write-time authorization in SQL.
export async function requireOwnedProperty(
  db: D1Database,
  actor: Actor,
  id: string,
) {
  const property = await db
    .prepare("SELECT id FROM property WHERE id=? AND owner_id=?")
    .bind(id, actor.id)
    .first();
  if (!property) throw new DomainError("not_found", 404);
}
export async function requireBookingActor(
  db: D1Database,
  actor: Actor,
  id: string,
  asGuest: boolean,
) {
  const allowed = await db
    .prepare(
      "SELECT b.id FROM booking b WHERE b.id=? AND " +
        (asGuest
          ? "b.guest_id=?"
          : "EXISTS(SELECT 1 FROM property p WHERE p.id=b.property_id AND p.owner_id=?)"),
    )
    .bind(id, actor.id)
    .first();
  if (!allowed) throw new DomainError("not_found", 404);
}
export async function requireOwnedRoom(
  db: D1Database,
  actor: Actor,
  id: string,
) {
  const room = await db
    .prepare(
      "SELECT r.id FROM room_type r JOIN property p ON p.id=r.property_id WHERE r.id=? AND p.owner_id=?",
    )
    .bind(id, actor.id)
    .first();
  if (!room) throw new DomainError("not_found", 404);
}
// Trusted system discovery only; expireRequest rechecks the deadline in its batch.
export async function findDueRequests(db: D1Database, limit: number) {
  const due = await db
    .prepare(
      "SELECT id FROM booking WHERE status='pending' AND expires_at<=unixepoch() ORDER BY expires_at,id LIMIT ?",
    )
    .bind(limit)
    .all<{ id: string }>();
  return due.results;
}

// Account capabilities (ADR 0010). Guest is every verified account. Admin and
// approved owner are rows read per request; writes repeat these predicates in
// their batch so a revocation takes effect at commit time.
export const adminSQL =
  "EXISTS(SELECT 1 FROM platform_staff s JOIN user u ON u.id=s.user_id WHERE s.user_id=? AND s.role='admin' AND s.active=1 AND u.emailVerified=1)";
export const anyAdminSQL =
  "EXISTS(SELECT 1 FROM platform_staff s JOIN user u ON u.id=s.user_id WHERE s.role='admin' AND s.active=1 AND u.emailVerified=1)";
export const approvedOwnerSQL =
  "EXISTS(SELECT 1 FROM owner_access WHERE user_id=? AND status='approved')";
export async function capabilities(db: D1Database, actor: Actor) {
  await verified(db, actor);
  const row = await db
    .prepare(`SELECT ${adminSQL} AS admin, ${approvedOwnerSQL} AS owner`)
    .bind(actor.id, actor.id)
    .first<{ admin: number; owner: number }>();
  return { guest: true, owner: row?.owner === 1, admin: row?.admin === 1 };
}
export async function adminConfigured(db: D1Database) {
  return !!(await db.prepare(`SELECT 1 ok WHERE ${anyAdminSQL}`).first());
}
