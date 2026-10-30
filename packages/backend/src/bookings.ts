import { DomainError } from "./errors";
import { quote, normalize } from "./quotes";
import { verified, type Actor } from "./operations";
import {
  requireOwnedProperty,
  requireBookingActor,
  findDueRequests,
} from "./access";
import {
  commitRequest,
  commitBookingTransition,
  expireRequest,
  type BookingChange,
} from "./booking-persistence";

export async function submit(
  db: D1Database,
  actor: Actor,
  key: string,
  raw: unknown,
  quoteHash: string,
  source: "online" | "external" = "online",
) {
  await verified(db, actor);
  const input = normalize(raw);
  if (source === "external")
    await requireOwnedProperty(db, actor, input.propertyId);
  return commitRequest(db, actor, key, input, quoteHash, source, async () => {
    const q = await quote(db, actor, input, source);
    if (q.hash !== quoteHash) throw new DomainError("quote_changed");
    return q;
  });
}

export type Action = BookingChange | "check_in";
export async function transition(
  db: D1Database,
  actor: Actor,
  key: string,
  id: string,
  action: Action,
  reason?: string,
  acceptanceHash?: string,
) {
  await verified(db, actor);
  await requireBookingActor(db, actor, id, action === "cancel_guest");
  const text = reason?.trim() || null;
  if (text && text.length > 2000) throw new DomainError("invalid_reason", 422);
  if (action === "cancel_owner" && !text)
    throw new DomainError("owner_reason_required", 422);
  // Arrival cutoff/late-arrival procedure is not agreed. No inferred no-show transition.
  if (action === "check_in")
    throw new DomainError("arrival_policy_decision_required", 422);
  if (
    !["accept", "decline", "cancel_guest", "cancel_owner", "complete"].includes(
      action,
    )
  )
    throw new DomainError("invalid_action", 422);
  if (
    acceptanceHash !== undefined &&
    (action !== "accept" || !/^[a-f0-9]{64}$/.test(acceptanceHash))
  )
    throw new DomainError("invalid_request", 422);
  return commitBookingTransition(
    db,
    actor,
    key,
    id,
    action,
    text,
    acceptanceHash,
  );
}

export async function expireDue(db: D1Database, limit = 50) {
  if (!Number.isInteger(limit) || limit < 1 || limit > 100)
    throw new DomainError("invalid_limit", 422);
  const due = await findDueRequests(db, limit);
  for (const { id } of due) {
    try {
      await expireRequest(db, id);
    } catch (error) {
      if (!(error instanceof DomainError && error.code === "booking_conflict"))
        throw error;
    }
  }
  return due.length;
}
