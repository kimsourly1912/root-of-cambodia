import { DomainError } from "./errors";
import { verified, digest, type Actor } from "./operations";
export type LogisticsCopy = {
  address: string;
  latitude: number | null;
  longitude: number | null;
  contactName: string;
  contactPhone: string;
  contactEmail: string;
  arrivalInstructions: string;
};
type Source = LogisticsCopy & {
  propertyId: string;
  ownerId: string;
  informationRevision: number | null;
  logisticsRevision: number | null;
};
export async function acceptancePreview(
  db: D1Database,
  actor: Actor,
  bookingId: string,
) {
  await verified(db, actor);
  const source = await db
    .prepare(
      `SELECT p.id AS propertyId,p.owner_id AS ownerId,i.revision AS informationRevision,d.revision AS logisticsRevision,
 coalesce(i.address_text,'') AS address,d.latitude,d.longitude,coalesce(d.contact_name,'') AS contactName,
 coalesce(d.contact_phone,'') AS contactPhone,coalesce(d.contact_email,'') AS contactEmail,coalesce(d.arrival_instructions,'') AS arrivalInstructions
 FROM booking b JOIN property p ON p.id=b.property_id JOIN user u ON u.id=p.owner_id AND u.emailVerified=1 LEFT JOIN property_information i ON i.property_id=p.id LEFT JOIN property_logistics d ON d.property_id=p.id
 WHERE b.id=? AND b.status!='building' AND p.owner_id=?`,
    )
    .bind(bookingId, actor.id)
    .first<Source>();
  if (!source) throw new DomainError("not_found", 404);
  const details: LogisticsCopy = {
    address: source.address,
    latitude: source.latitude ?? null,
    longitude: source.longitude ?? null,
    contactName: source.contactName,
    contactPhone: source.contactPhone,
    contactEmail: source.contactEmail,
    arrivalInstructions: source.arrivalInstructions,
  };
  const hash = await digest({ bookingId, ...source });
  return {
    hash,
    details,
    ready:
      !!details.address.trim() &&
      !!(details.contactPhone.trim() || details.contactEmail.trim()),
    informationRevision: source.informationRevision,
    logisticsRevision: source.logisticsRevision,
    propertyId: source.propertyId,
  };
}
export async function prepareAcceptance(
  db: D1Database,
  actor: Actor,
  id: string,
  hash?: string,
) {
  if (!hash) throw new DomainError("acceptance_preview_required", 422);
  const preview = await acceptancePreview(db, actor, id);
  if (hash !== preview.hash)
    throw new DomainError("acceptance_preview_changed");
  if (!preview.ready) throw new DomainError("acceptance_incomplete", 422);
  return preview;
}
export type AcceptancePreview = Awaited<ReturnType<typeof acceptancePreview>>;
export function logisticsDetails(raw: string): LogisticsCopy {
  const value = JSON.parse(raw) as Record<string, unknown>;
  const text = (key: string) => {
    if (typeof value[key] !== "string")
      throw new Error("Invalid stored logistics");
    return value[key] as string;
  };
  const coordinate = (key: string) => {
    const n = value[key];
    if (n !== null && (typeof n !== "number" || !Number.isFinite(n)))
      throw new Error("Invalid stored logistics");
    return n as number | null;
  };
  return {
    address: text("address"),
    latitude: coordinate("latitude"),
    longitude: coordinate("longitude"),
    contactName: text("contactName"),
    contactPhone: text("contactPhone"),
    contactEmail: text("contactEmail"),
    arrivalInstructions: text("arrivalInstructions"),
  };
}
