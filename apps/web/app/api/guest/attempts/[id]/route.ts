import { endpoint } from "@/server/http";
import {
  guestAttempt,
  saveGuestAttempt,
} from "@root-of-cambodia/backend/bookings";
export const dynamic = "force-dynamic";
type Context = { params: Promise<{ id: string }> };
export async function GET(request: Request, context: Context) {
  return endpoint(request, false, async ({ db, actor }) =>
    guestAttempt(db, actor, (await context.params).id),
  );
}
export async function POST(request: Request, context: Context) {
  return endpoint(request, true, async ({ db, actor, body }) =>
    saveGuestAttempt(
      db,
      actor,
      (await context.params).id,
      body,
      body.quoteHash,
    ),
  );
}
