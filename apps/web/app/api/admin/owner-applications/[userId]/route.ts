import { endpoint } from "@/server/http";
import { decideOwnerApplication } from "@root-of-cambodia/backend/owner-access";
export const dynamic = "force-dynamic";
type Context = { params: Promise<{ userId: string }> };
export async function POST(request: Request, context: Context) {
  const { userId } = await context.params;
  return endpoint(request, true, ({ db, actor, key, body }) =>
    decideOwnerApplication(db, actor, key, userId, body),
  );
}
