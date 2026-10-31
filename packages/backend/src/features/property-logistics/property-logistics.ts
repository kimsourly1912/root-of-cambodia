import { verified, type Actor } from "../../shared/index";
import { requireOwnedProperty } from "../../shared/index";
import { DomainError } from "../../shared/index";
import { commitPropertyLogistics } from "./property-logistics-persistence";
import type { PropertyLogistics } from "./property-logistics-queries";

export type PropertyLogisticsEdit = PropertyLogistics;
function normalize(input: Record<string, unknown>): PropertyLogisticsEdit {
  const allowed = ["latitude", "longitude", "contactName", "contactPhone", "contactEmail", "arrivalInstructions", "revision"];
  if (Object.keys(input).some((key) => !allowed.includes(key)))
    throw new DomainError("invalid_property_logistics", 422);
  for (const [field, max] of [["latitude", 90], ["longitude", 180]] as const) {
    const value = input[field];
    if (value !== null && (typeof value !== "number" || !Number.isFinite(value) || Math.abs(value) > max))
      throw new DomainError("invalid_property_logistics", 422);
  }
  if ((input.latitude === null) !== (input.longitude === null))
    throw new DomainError("invalid_property_logistics", 422);
  const text = (field: string, max: number, multiline = false) => {
    const value = input[field];
    if (typeof value !== "string" || value.trim().length > max ||
      (multiline ? /[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/ : /[\u0000-\u001f\u007f]/).test(value))
      throw new DomainError("invalid_property_logistics", 422);
    return value.trim();
  };
  const contactName = text("contactName", 200),
    contactPhone = text("contactPhone", 100),
    contactEmail = text("contactEmail", 254),
    arrivalInstructions = text("arrivalInstructions", 5000, true);
  if (contactEmail && !/^[^\s@]+@[^\s@]+$/.test(contactEmail))
    throw new DomainError("invalid_property_logistics", 422);
  if (input.revision !== null && (!Number.isSafeInteger(input.revision) || Number(input.revision) < 1))
    throw new DomainError("invalid_property_logistics", 422);
  return {
    latitude: input.latitude as number | null,
    longitude: input.longitude as number | null,
    contactName, contactPhone, contactEmail, arrivalInstructions,
    revision: input.revision as number | null,
  };
}
export async function savePropertyLogistics(
  db: D1Database, actor: Actor, key: string, propertyId: string,
  input: Record<string, unknown>,
) {
  await verified(db, actor);
  await requireOwnedProperty(db, actor, propertyId);
  const receipt = await commitPropertyLogistics(db, actor, key, propertyId, normalize(input));
  await verified(db, actor);
  await requireOwnedProperty(db, actor, propertyId);
  return receipt;
}
