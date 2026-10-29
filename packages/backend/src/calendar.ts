import type { Actor } from "./operations";
import { ownerRoomType } from "./room-queries";
import { DomainError } from "./errors";
import { validNight, shiftNight } from "./calendar-dates";
import { commitRoomCalendar } from "./calendar-persistence";
export type CalendarEditNight = {
  night: string;
  capacity: number;
  blocked: number;
  unitCents: number;
  inventoryRevision: number | null;
  rateRevision: number | null;
};
export type CalendarEdit = {
  roomRevision: number;
  nights: CalendarEditNight[];
};
function normalize(input: Record<string, unknown>): CalendarEdit {
  if (
    Object.keys(input).some((k) => !["roomRevision", "nights"].includes(k)) ||
    !Number.isSafeInteger(input.roomRevision) ||
    Number(input.roomRevision) < 1 ||
    !Array.isArray(input.nights) ||
    input.nights.length < 1 ||
    input.nights.length > 7
  )
    throw new DomainError("invalid_calendar", 422);
  const nights = input.nights
    .map((raw: unknown) => {
      if (!raw || typeof raw !== "object" || Array.isArray(raw))
        throw new DomainError("invalid_calendar", 422);
      const value = raw as Record<string, unknown>;
      const allowed = [
        "night",
        "capacity",
        "blocked",
        "unitCents",
        "inventoryRevision",
        "rateRevision",
      ];
      if (
        Object.keys(value).some((k) => !allowed.includes(k)) ||
        !validNight(value.night)
      )
        throw new DomainError("invalid_calendar", 422);
      for (const [field, max] of [
        ["capacity", 10000],
        ["blocked", 10000],
        ["unitCents", 100000000],
      ] as const) {
        const n = value[field];
        if (typeof n !== "number" || !Number.isInteger(n) || n < 0 || n > max)
          throw new DomainError("invalid_calendar", 422);
      }
      for (const field of ["inventoryRevision", "rateRevision"]) {
        const n = value[field];
        if (n !== null && (!Number.isSafeInteger(n) || Number(n) < 1))
          throw new DomainError("invalid_calendar", 422);
      }
      if (Number(value.blocked) > Number(value.capacity))
        throw new DomainError("invalid_calendar", 422);
      return {
        night: value.night,
        capacity: Number(value.capacity),
        blocked: Number(value.blocked),
        unitCents: Number(value.unitCents),
        inventoryRevision: value.inventoryRevision as number | null,
        rateRevision: value.rateRevision as number | null,
      };
    })
    .sort((a, b) => a.night.localeCompare(b.night));
  if (
    new Set(nights.map((n) => n.night)).size !== nights.length ||
    nights.at(-1)!.night > shiftNight(nights[0].night, 6)
  )
    throw new DomainError("invalid_calendar", 422);
  return { roomRevision: Number(input.roomRevision), nights };
}
export async function saveRoomCalendar(
  db: D1Database,
  actor: Actor,
  key: string,
  propertyId: string,
  roomId: string,
  input: Record<string, unknown>,
) {
  await ownerRoomType(db, actor, propertyId, roomId);
  const fields = normalize(input);
  const receipt = await commitRoomCalendar(
    db,
    actor,
    key,
    propertyId,
    roomId,
    fields,
  );
  await ownerRoomType(db, actor, propertyId, roomId);
  return receipt;
}
