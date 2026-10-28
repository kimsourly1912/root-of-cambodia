import { endpoint } from "../../../../../src/http";
import { transition, type Action } from "@root-of-cambodia/backend/bookings";
import { DomainError } from "@root-of-cambodia/backend/errors";
export const dynamic = "force-dynamic";
const actions: Action[] = [
  "accept",
  "decline",
  "cancel_guest",
  "cancel_owner",
  "check_in",
  "complete",
];
export async function POST(
  request: Request,
  context: { params: Promise<{ id: string; action: string }> },
) {
  return endpoint(request, true, async ({ db, actor, key, body }) => {
    const { id, action } = await context.params;
    if (!actions.includes(action as Action))
      throw new DomainError("not_found", 404);
    if (body.reason !== undefined && typeof body.reason !== "string")
      throw new DomainError("invalid_reason", 422);
    return transition(
      db,
      actor,
      key,
      id,
      action as Action,
      body.reason as string | undefined,
    );
  });
}
