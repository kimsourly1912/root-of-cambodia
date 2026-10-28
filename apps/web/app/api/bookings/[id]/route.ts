import { endpoint } from "../../../../src/http";
import { readBooking } from "@root-of-cambodia/backend/access";
export const dynamic = "force-dynamic";
export async function GET(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  return endpoint(request, false, async ({ db, actor }) =>
    readBooking(db, actor, (await context.params).id),
  );
}
