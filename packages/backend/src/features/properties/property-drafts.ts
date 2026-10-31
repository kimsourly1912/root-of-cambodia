import { verified, type Actor } from "../../shared/index";
import { requireOwnedProperty } from "../../shared/index";
import { DomainError } from "../../shared/index";
import { commitCreateDraft, commitUpdateDraft } from "./property-persistence";
export type DraftFields = {
  nameKm: string;
  nameEn: string;
  province: string;
  checkinTime: string;
  checkoutTime: string;
  policyText: string;
};
export type CreateDraft = DraftFields & { ownerName: string };
export type UpdateDraft = DraftFields & { revision: number };
function normalize(
  input: Record<string, unknown>,
  create: boolean,
): CreateDraft | UpdateDraft {
  const allowed = [
    "nameKm",
    "nameEn",
    "province",
    "checkinTime",
    "checkoutTime",
    "policyText",
    create ? "ownerName" : "revision",
  ];
  if (Object.keys(input).some((key) => !allowed.includes(key)))
    throw new DomainError("invalid_property", 422);
  const text = (key: string, min: number, max: number) => {
    const value = input[key];
    if (
      typeof value !== "string" ||
      value.trim().length < min ||
      value.trim().length > max
    )
      throw new DomainError("invalid_property", 422);
    return value.trim();
  };
  const fields: DraftFields = {
    nameKm: text("nameKm", 1, 200),
    nameEn: input.nameEn === undefined ? "" : text("nameEn", 0, 200),
    province: text("province", 1, 100),
    checkinTime: text("checkinTime", 5, 5),
    checkoutTime: text("checkoutTime", 5, 5),
    policyText: text("policyText", 1, 10000),
  };
  if (
    ![fields.checkinTime, fields.checkoutTime].every((time) =>
      /^([01][0-9]|2[0-3]):[0-5][0-9]$/.test(time),
    )
  )
    throw new DomainError("invalid_property", 422);
  if (create) return { ...fields, ownerName: text("ownerName", 1, 200) };
  if (!Number.isSafeInteger(input.revision) || Number(input.revision) < 1)
    throw new DomainError("invalid_property", 422);
  return { ...fields, revision: Number(input.revision) };
}
export async function createPropertyDraft(
  db: D1Database,
  actor: Actor,
  key: string,
  input: Record<string, unknown>,
) {
  await verified(db, actor);
  const fields = normalize(input, true) as CreateDraft;
  const receipt = await commitCreateDraft(db, actor, key, fields);
  // Recovered receipts still require current access to the created resource.
  await verified(db, actor);
  await requireOwnedProperty(db, actor, receipt.id);
  return receipt;
}
export async function updatePropertyDraft(
  db: D1Database,
  actor: Actor,
  key: string,
  id: string,
  input: Record<string, unknown>,
) {
  await verified(db, actor);
  await requireOwnedProperty(db, actor, id);
  // A completed save must replay before checking the current revision/state.
  return commitUpdateDraft(
    db,
    actor,
    key,
    id,
    normalize(input, false) as UpdateDraft,
  );
}
