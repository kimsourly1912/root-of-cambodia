import { DomainError } from "./errors";
import type { Actor } from "./operations";

// Internal quote reads. quote() verifies the actor before calling these queries;
// property scope is checked before room/rate/calendar reads. Commit rechecks it.
type Property = {
  id: string;
  owner_id: string;
  name: string;
  publication: string;
  checkin_time: string;
  checkout_time: string;
  policy_version: string;
  policy_text: string;
  terms_version: string;
  charges_json: string;
  revision: number;
};
type Room = {
  id: string;
  name: string;
  adult_capacity: number;
  child_capacity: number;
  total_capacity: number;
  revision: number;
};

export async function readQuoteProperty(
  db: D1Database,
  actor: Actor,
  id: string,
  source: "online" | "external",
) {
  const property = await db
    .prepare(
      "SELECT p.*,pl.name_km AS name,pl.publication FROM property p JOIN place pl ON pl.id=p.id WHERE p.id=?",
    )
    .bind(id)
    .first<Property>();
  if (
    !property ||
    (source === "online"
      ? property.publication !== "published"
      : property.owner_id !== actor.id)
  )
    throw new DomainError("not_found", 404);
  return property;
}
export async function readQuoteRoom(
  db: D1Database,
  propertyId: string,
  roomId: string,
) {
  const room = await db
    .prepare(
      "SELECT * FROM room_type WHERE id=? AND property_id=? AND active=1",
    )
    .bind(roomId, propertyId)
    .first<Room>();
  if (!room) throw new DomainError("room_unavailable");
  return room;
}
export async function readQuoteRates(
  db: D1Database,
  roomId: string,
  checkin: string,
  checkout: string,
) {
  const rates = await db
    .prepare(
      "SELECT night,unit_cents,revision FROM nightly_rate WHERE room_type_id=? AND night>=? AND night<? ORDER BY night",
    )
    .bind(roomId, checkin, checkout)
    .all<{ night: string; unit_cents: number; revision: number }>();
  return rates.results;
}
export async function readQuoteStock(
  db: D1Database,
  roomId: string,
  checkin: string,
  checkout: string,
) {
  const stock = await db
    .prepare(
      "SELECT night,capacity-blocked-reserved AS available FROM inventory_night WHERE room_type_id=? AND night>=? AND night<? ORDER BY night",
    )
    .bind(roomId, checkin, checkout)
    .all<{ night: string; available: number }>();
  return stock.results;
}
