import { endpoint } from "@/src/http";
import { prepareExternalReview, externalReview } from "@root-of-cambodia/backend/external-bookings";
export const dynamic = "force-dynamic";
type Context = {params: Promise<{id: string; attemptId: string}>};
export async function GET(request: Request, context: Context) {
  return endpoint(request, false, async ({db, actor}) => {
    const {id, attemptId} = await context.params;
    return externalReview(db, actor, id, attemptId);
  });
}
export async function POST(request: Request, context: Context) {
  return endpoint(request, true, async ({db, actor, body}) => {
    const {id, attemptId} = await context.params;
    return prepareExternalReview(db, actor, id, attemptId, body);
  });
}
