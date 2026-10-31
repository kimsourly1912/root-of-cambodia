import { endpoint } from "@/server/http";
import { applyOwnerAttempt } from "@root-of-cambodia/backend/bookings";
export const dynamic = "force-dynamic";
export async function POST(
  request: Request,
  context: { params: Promise<{ id: string; attemptId: string }> },
) {
  return endpoint(request, true, async ({ db, actor }) => {
    const { id, attemptId } = await context.params;
    return applyOwnerAttempt(db, actor, id, attemptId);
  });
}
