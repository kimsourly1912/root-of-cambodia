import { endpoint } from "../../../../../../../src/http";
import { updateRoomType } from "@root-of-cambodia/backend/room-types";
import { ownerRoomType } from "@root-of-cambodia/backend/room-queries";
export const dynamic = "force-dynamic";
type Context = { params: Promise<{ id: string; roomId: string }> };
export async function GET(request: Request, context: Context) {
  const { id, roomId } = await context.params;
  return endpoint(request, false, ({ db, actor }) =>
    ownerRoomType(db, actor, id, roomId),
  );
}
export async function PATCH(request: Request, context: Context) {
  const { id, roomId } = await context.params;
  return endpoint(request, true, ({ db, actor, key, body }) =>
    updateRoomType(db, actor, key, id, roomId, body),
  );
}
