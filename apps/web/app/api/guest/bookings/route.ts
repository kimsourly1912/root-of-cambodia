import { endpoint } from "@/server/http";
import { guestBookings } from "@root-of-cambodia/backend/bookings";
import { DomainError } from "@root-of-cambodia/backend/shared";
export const dynamic = "force-dynamic";
export async function GET(request: Request) {
  return endpoint(request, false, ({ db, actor }) => {
    const params = new URL(request.url).searchParams;
    if (
      [...params.keys()].some((k) => k !== "cursor") ||
      params.getAll("cursor").length > 1
    )
      throw new DomainError("invalid_request", 422);
    return guestBookings(db, actor, params.get("cursor") ?? undefined);
  });
}
