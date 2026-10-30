import { endpoint } from "@/src/http";
import { ownerPayments } from "@root-of-cambodia/backend/payment-queries";
import { DomainError } from "@root-of-cambodia/backend/errors";
export const dynamic = "force-dynamic";
export async function GET(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  return endpoint(request, false, async ({ db, actor }) => {
    const q = new URL(request.url).searchParams;
    if (
      [...q.keys()].some((k) => k !== "cursor") ||
      q.getAll("cursor").length > 1
    )
      throw new DomainError("invalid_request", 422);
    return ownerPayments(
      db,
      actor,
      (await context.params).id,
      q.get("cursor") ?? undefined,
    );
  });
}
