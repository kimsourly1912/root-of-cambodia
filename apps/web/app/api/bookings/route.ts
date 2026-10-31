import { endpoint } from "@/server/http";
import { submit } from "@root-of-cambodia/backend/bookings";
import { DomainError } from "@root-of-cambodia/backend/shared";
export const dynamic = "force-dynamic";
export async function POST(request: Request) {
  return endpoint(request, true, ({ db, actor, key, body }) => {
    if (typeof body.quoteHash !== "string")
      throw new DomainError("quote_required", 422);
    return submit(db, actor, key, body, body.quoteHash);
  });
}
