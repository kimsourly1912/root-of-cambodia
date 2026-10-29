import { verified, type Actor } from "./operations";
import { requireOwnedProperty } from "./access";
import { DomainError } from "./errors";
import { commitPropertyInformation } from "./property-information-persistence";
import type { PropertyInformation } from "./property-information-queries";
export type PropertyInformationEdit = PropertyInformation;
function normalize(input: Record<string, unknown>): PropertyInformationEdit {
  const allowed = ["description", "address", "facilities", "revision"];
  if (Object.keys(input).some((k) => !allowed.includes(k)))
    throw new DomainError("invalid_property_information", 422);
  const text = (field: string, max: number) => {
    const value = input[field];
    if (
      typeof value !== "string" ||
      value.trim().length > max ||
      /[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/.test(value)
    )
      throw new DomainError("invalid_property_information", 422);
    return value.trim();
  };
  const description = text("description", 5000),
    address = text("address", 1000);
  if (!Array.isArray(input.facilities) || input.facilities.length > 30)
    throw new DomainError("invalid_property_information", 422);
  const facilities = input.facilities.map((value: unknown) => {
    if (
      typeof value !== "string" ||
      !value.trim() ||
      value.trim().length > 120 ||
      /[\u0000-\u001f\u007f]/.test(value.trim())
    )
      throw new DomainError("invalid_property_information", 422);
    return value.trim();
  });
  if (
    new Set(facilities).size !== facilities.length ||
    (input.revision !== null &&
      (!Number.isSafeInteger(input.revision) || Number(input.revision) < 1))
  )
    throw new DomainError("invalid_property_information", 422);
  return {
    description,
    address,
    facilities,
    revision: input.revision as number | null,
  };
}
export async function savePropertyInformation(
  db: D1Database,
  actor: Actor,
  key: string,
  propertyId: string,
  input: Record<string, unknown>,
) {
  await verified(db, actor);
  await requireOwnedProperty(db, actor, propertyId);
  const receipt = await commitPropertyInformation(
    db,
    actor,
    key,
    propertyId,
    normalize(input),
  );
  await verified(db, actor);
  await requireOwnedProperty(db, actor, propertyId);
  return receipt;
}
