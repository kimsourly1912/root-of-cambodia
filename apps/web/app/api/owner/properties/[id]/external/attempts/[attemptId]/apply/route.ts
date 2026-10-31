import { endpoint } from "@/server/http";
import { applyExternalReview } from "@root-of-cambodia/backend/external-bookings";
export const dynamic = "force-dynamic";
export async function POST(request: Request, context: {params: Promise<{id: string; attemptId: string}>}) {
  return endpoint(request, true, async ({db, actor, body}) => {
    const {id, attemptId} = await context.params;
    return applyExternalReview(db, actor, id, attemptId, body);
  });
}
