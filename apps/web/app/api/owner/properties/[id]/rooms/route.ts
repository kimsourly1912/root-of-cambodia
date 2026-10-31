import { endpoint } from "@/server/http";
import { createRoomType } from "@root-of-cambodia/backend/rooms";
import { ownerRoomTypes } from "@root-of-cambodia/backend/rooms";
export const dynamic = "force-dynamic";
type Context = { params: Promise<{ id: string }> };
export async function GET(request: Request, context: Context) {
  const { id } = await context.params;
  return endpoint(request, false, ({ db, actor }) =>
    ownerRoomTypes(
      db,
      actor,
      id,
      new URL(request.url).searchParams.get("cursor") ?? "",
    ),
  );
}
export async function POST(request: Request, context: Context) {
  const { id } = await context.params;
  return endpoint(
    request,
    true,
    ({ db, actor, key, body }) => createRoomType(db, actor, key, id, body),
    201,
  );
}
