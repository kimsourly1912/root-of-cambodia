import { endpoint } from "@/server/http";
import { sendGuestAttempt } from "@root-of-cambodia/backend/bookings";
export const dynamic = "force-dynamic";
export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  return endpoint(request, true, async ({ db, actor, body }) =>
    sendGuestAttempt(db, actor, (await context.params).id, body.acceptedTerms),
  );
}
