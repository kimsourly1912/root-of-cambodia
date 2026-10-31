import { verified, type Actor } from "../../shared/index";
import { DomainError } from "../../shared/index";
export type PropertyInformation = {
  description: string;
  address: string;
  facilities: string[];
  revision: number | null;
};
export async function ownerPropertyInformation(
  db: D1Database,
  actor: Actor,
  propertyId: string,
): Promise<PropertyInformation> {
  await verified(db, actor);
  const row = await db
    .prepare(
      "SELECT d.description_text,d.address_text,d.facilities_json,d.revision FROM property p LEFT JOIN property_information d ON d.property_id=p.id WHERE p.id=? AND p.owner_id=?",
    )
    .bind(propertyId, actor.id)
    .first<{
      description_text: string | null;
      address_text: string | null;
      facilities_json: string | null;
      revision: number | null;
    }>();
  if (!row) throw new DomainError("not_found", 404);
  return {
    description: row.description_text ?? "",
    address: row.address_text ?? "",
    facilities:
      row.facilities_json === null
        ? []
        : (JSON.parse(row.facilities_json) as string[]),
    revision: row.revision,
  };
}
