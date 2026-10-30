import { verified, digest, type Actor, type Receipt } from "./operations";
import { requireBookingActor } from "./access";
export type StayAction = "check_in" | "complete";
export function stayIntent(
  action: unknown,
  attempt: unknown,
): { action: StayAction; attempt: string } | null {
  return (action === "check_in" || action === "complete") &&
    typeof attempt === "string" &&
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/.test(
      attempt,
    )
    ? { action, attempt }
    : null;
}
export async function ownerStayReceipt(
  db: D1Database,
  actor: Actor,
  id: string,
  intent: { action: StayAction; attempt: string },
) {
  await verified(db, actor);
  await requireBookingActor(db, actor, id, false);
  const fingerprint = await digest({
    role: "owner",
    payload: { kind: intent.action, id, reason: null },
  });
  const row = await db
    .prepare(
      `SELECT o.result_json FROM operation o JOIN booking b ON b.id=? JOIN property p ON p.id=b.property_id JOIN user u ON u.id=p.owner_id AND u.emailVerified=1
 WHERE p.owner_id=? AND o.principal=? AND o.key=? AND o.fingerprint=? AND o.kind=? AND json_extract(o.result_json,'$.id')=b.id`,
    )
    .bind(
      id,
      actor.id,
      "user:" + actor.id,
      "stay:" + intent.attempt,
      fingerprint,
      intent.action,
    )
    .first<{ result_json: string }>();
  return row ? (JSON.parse(row.result_json) as Receipt) : null;
}
