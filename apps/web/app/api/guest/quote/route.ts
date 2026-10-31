import { endpoint } from "@/src/http";
import { guestQuote } from "@root-of-cambodia/backend/bookings";
export const dynamic = "force-dynamic";
export async function POST(request: Request) {
  return endpoint(request, true, ({ db, actor, body }) =>
    guestQuote(db, actor, body),
  );
}
