export type Actor = { id: string; emailVerified: boolean };
export class BookingError extends Error {
  constructor(public code: string) { super(code); }
}
// Actor is created by the server session adapter, never read from a client payload.
export async function accept(db: D1Database, id: string, actor: Actor) {
  if (!actor.emailVerified) throw new BookingError("email_unverified");
  const result = await db.prepare(`
    UPDATE booking SET status='confirmed', confirmed_at=unixepoch()
    WHERE id=? AND status='pending' AND expires_at>unixepoch()
      AND EXISTS(SELECT 1 FROM property p WHERE p.id=booking.property_id AND p.owner_id=?)
  `).bind(id, actor.id).run();
  if (result.meta.changes === 0) {
    const row = await db.prepare(`
      SELECT b.status,p.owner_id FROM booking b JOIN property p ON p.id=b.property_id WHERE b.id=?
    `).bind(id).first<{status:string;owner_id:string}>();
    if (!row || row.owner_id !== actor.id) throw new BookingError("not_found");
    if (row.status === "confirmed") return { status: "confirmed", repeated: true };
    throw new BookingError("booking_conflict");
  }
  return { status: "confirmed", repeated: false };
}
export async function cancel(db: D1Database, id: string, actor: Actor) {
  if (!actor.emailVerified) throw new BookingError("email_unverified");
  const result = await db.prepare(`
    UPDATE booking SET status='cancelled', cancelled_at=unixepoch()
    WHERE id=? AND status IN ('pending','confirmed') AND checkin_at>unixepoch()
      AND (guest_id=? OR EXISTS(SELECT 1 FROM property p WHERE p.id=booking.property_id AND p.owner_id=?))
  `).bind(id,actor.id,actor.id).run();
  // D1's changes metadata includes trigger side effects, so a successful
  // single-booking transition can report more than one changed row.
  return { changed: result.meta.changes > 0 };
}
