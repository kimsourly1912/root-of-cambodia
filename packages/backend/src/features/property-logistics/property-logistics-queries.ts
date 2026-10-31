import { verified, type Actor } from "../../shared/index";
import { DomainError } from "../../shared/index";

export type PropertyLogistics = {
  latitude: number | null;
  longitude: number | null;
  contactName: string;
  contactPhone: string;
  contactEmail: string;
  arrivalInstructions: string;
  revision: number | null;
};
export async function ownerPropertyLogistics(
  db: D1Database,
  actor: Actor,
  propertyId: string,
): Promise<PropertyLogistics> {
  await verified(db, actor);
  const row = await db.prepare(
    "SELECT d.latitude,d.longitude,d.contact_name AS contactName,d.contact_phone AS contactPhone,d.contact_email AS contactEmail,d.arrival_instructions AS arrivalInstructions,d.revision FROM property p LEFT JOIN property_logistics d ON d.property_id=p.id WHERE p.id=? AND p.owner_id=?",
  ).bind(propertyId, actor.id).first<PropertyLogistics>();
  if (!row) throw new DomainError("not_found", 404);
  return {
    latitude: row.latitude ?? null,
    longitude: row.longitude ?? null,
    contactName: row.contactName ?? "",
    contactPhone: row.contactPhone ?? "",
    contactEmail: row.contactEmail ?? "",
    arrivalInstructions: row.arrivalInstructions ?? "",
    revision: row.revision,
  };
}
