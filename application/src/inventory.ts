import { DomainError } from "./errors";
import { verified, type Actor } from "./operations";
import { requireOwnedRoom } from "./access";
import { editInventoryNight } from "./inventory-persistence";
export async function editInventory(
  db: D1Database,
  actor: Actor,
  key: string,
  raw: unknown,
) {
  if (!raw || typeof raw !== "object" || Array.isArray(raw))
    throw new DomainError("invalid_inventory", 422);
  const value = raw as Record<string, unknown>;
  if (
    typeof value.roomId !== "string" ||
    typeof value.night !== "string" ||
    typeof value.capacity !== "number" ||
    typeof value.blocked !== "number" ||
    typeof value.revision !== "number"
  )
    throw new DomainError("invalid_inventory", 422);
  const input = {
    roomId: value.roomId,
    night: value.night,
    capacity: value.capacity,
    blocked: value.blocked,
    revision: value.revision,
  };
  if (
    !/^\d{4}-\d{2}-\d{2}$/.test(input.night) ||
    !Number.isFinite(Date.parse(input.night)) ||
    new Date(input.night).toISOString().slice(0, 10) !== input.night ||
    input.revision < 1
  )
    throw new DomainError("invalid_inventory", 422);
  await verified(db, actor);
  if (
    ![input.capacity, input.blocked].every(
      (n) => Number.isInteger(n) && n >= 0 && n <= 10000,
    ) ||
    !Number.isSafeInteger(input.revision)
  )
    throw new DomainError("invalid_inventory", 422);
  await requireOwnedRoom(db, actor, input.roomId);
  return editInventoryNight(db, actor, key, input);
}
