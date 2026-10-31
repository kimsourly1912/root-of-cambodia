import { verified, type Actor } from "../../shared/index";
import { requireOwnedProperty } from "../../shared/index";
import { ownerRoomType } from "./room-queries";
import { DomainError } from "../../shared/index";
import { commitCreateRoomType, commitUpdateRoomType } from "./room-persistence";
export type RoomTypeFields = {
  name: string;
  adultCapacity: number;
  childCapacity: number;
  totalCapacity: number;
};
export type RoomTypeEdit = RoomTypeFields & { revision: number };
function normalize(
  input: Record<string, unknown>,
  edit: boolean,
): RoomTypeFields | RoomTypeEdit {
  const allowed = [
    "name",
    "adultCapacity",
    "childCapacity",
    "totalCapacity",
    ...(edit ? ["revision"] : []),
  ];
  if (
    Object.keys(input).some((key) => !allowed.includes(key)) ||
    typeof input.name !== "string" ||
    !input.name.trim() ||
    input.name.trim().length > 200
  )
    throw new DomainError("invalid_room_type", 422);
  // These are the existing per-unit schema limits. No age/infant or party-distribution policy is inferred.
  for (const [key, min] of [
    ["adultCapacity", 1],
    ["childCapacity", 0],
    ["totalCapacity", 1],
  ] as const) {
    const value = input[key];
    if (
      typeof value !== "number" ||
      !Number.isInteger(value) ||
      value < min ||
      value > 100
    )
      throw new DomainError("invalid_room_type", 422);
  }
  const fields: RoomTypeFields = {
    name: input.name.trim(),
    adultCapacity: Number(input.adultCapacity),
    childCapacity: Number(input.childCapacity),
    totalCapacity: Number(input.totalCapacity),
  };
  if (!edit) return fields;
  if (!Number.isSafeInteger(input.revision) || Number(input.revision) < 1)
    throw new DomainError("invalid_room_type", 422);
  return { ...fields, revision: Number(input.revision) };
}
export async function createRoomType(
  db: D1Database,
  actor: Actor,
  key: string,
  propertyId: string,
  input: Record<string, unknown>,
) {
  await verified(db, actor);
  await requireOwnedProperty(db, actor, propertyId);
  const receipt = await commitCreateRoomType(
    db,
    actor,
    key,
    propertyId,
    normalize(input, false),
  );
  await ownerRoomType(db, actor, propertyId, receipt.id);
  return receipt;
}
export async function updateRoomType(
  db: D1Database,
  actor: Actor,
  key: string,
  propertyId: string,
  id: string,
  input: Record<string, unknown>,
) {
  await ownerRoomType(db, actor, propertyId, id);
  // Replays retain their original receipt after later room or publication changes.
  return commitUpdateRoomType(
    db,
    actor,
    key,
    propertyId,
    id,
    normalize(input, true) as RoomTypeEdit,
  );
}
