import { endpoint } from "@/src/http";
import { applyPayment } from "@root-of-cambodia/backend/payments";
export const dynamic = "force-dynamic";
export async function POST(
  request: Request,
  context: { params: Promise<{ id: string; attemptId: string }> },
) {
  return endpoint(request, true, async ({ db, actor }) => {
    const { id, attemptId } = await context.params;
    return applyPayment(db, actor, id, attemptId);
  });
}
