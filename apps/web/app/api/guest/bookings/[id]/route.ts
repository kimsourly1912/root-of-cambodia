import { endpoint } from "@/server/http";
import { guestBooking } from "@root-of-cambodia/backend/bookings";
export const dynamic = "force-dynamic";
export async function GET(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  return endpoint(request, false, async ({ db, actor }) =>
    guestBooking(db, actor, (await context.params).id),
  );
}
