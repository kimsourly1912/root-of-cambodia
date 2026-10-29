import { endpoint } from "../../../../../../../../src/http";
import { ownerRoomCalendar } from "@root-of-cambodia/backend/calendar-queries";
import { saveRoomCalendar } from "@root-of-cambodia/backend/calendar";
import { cambodiaToday } from "@root-of-cambodia/backend/calendar-dates";
export const dynamic = "force-dynamic";
type Context = { params: Promise<{ id: string; roomId: string }> };
export async function GET(request: Request, context: Context) {
  const { id, roomId } = await context.params;
  return endpoint(request, false, ({ db, actor }) =>
    ownerRoomCalendar(
      db,
      actor,
      id,
      roomId,
      new URL(request.url).searchParams.get("start") ?? cambodiaToday(),
    ),
  );
}
export async function PATCH(request: Request, context: Context) {
  const { id, roomId } = await context.params;
  return endpoint(request, true, ({ db, actor, key, body }) =>
    saveRoomCalendar(db, actor, key, id, roomId, body),
  );
}
