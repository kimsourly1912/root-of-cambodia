import { endpoint } from "../../../src/http";
import { quote } from "@root-of-cambodia/backend/quotes";
import { submit } from "@root-of-cambodia/backend/bookings";
import { DomainError } from "@root-of-cambodia/backend/shared";
export const dynamic = "force-dynamic";
export async function POST(request: Request) {
  return endpoint(request, true, async ({ db, actor, key, body }) => {
    if (body.preview === true) {
      const q = await quote(db, actor, body, "external");
      return { hash: q.hash, totalCents: q.totalCents };
    }
    if (typeof body.quoteHash !== "string")
      throw new DomainError("quote_required", 422);
    return submit(db, actor, key, body, body.quoteHash, "external");
  });
}
