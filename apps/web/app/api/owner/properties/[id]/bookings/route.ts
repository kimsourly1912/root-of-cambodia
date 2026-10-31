import { endpoint } from "@/server/http";
import { ownerBookings } from "@root-of-cambodia/backend/bookings";
import { DomainError } from "@root-of-cambodia/backend/shared";
export const dynamic = "force-dynamic";
export async function GET(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  return endpoint(request, false, async ({ db, actor }) => {
    const q = new URL(request.url).searchParams;
    if (
      [...q.keys()].some((k) => k !== "cursor" && k !== "status") ||
      q.getAll("cursor").length > 1 ||
      q.getAll("status").length > 1
    )
      throw new DomainError("invalid_request", 422);
    return ownerBookings(
      db,
      actor,
      (await context.params).id,
      q.get("cursor") ?? undefined,
      q.get("status") ?? undefined,
    );
  });
}
