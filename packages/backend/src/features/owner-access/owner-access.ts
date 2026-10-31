import { DomainError, verified, type Actor } from "../../shared/index";
import { commitOwnerAccess } from "./owner-access-persistence";
import { requireAdmin } from "./owner-access-queries";

function text(value: unknown, min: number, max: number) {
  if (typeof value !== "string") throw new DomainError("invalid_owner_application", 422);
  const trimmed = value.trim();
  if (trimmed.length < min || trimmed.length > max) throw new DomainError("invalid_owner_application", 422);
  return trimmed;
}
function exactFields(input: Record<string, unknown>, allowed: string[]) {
  if (Object.keys(input).some((key) => !allowed.includes(key)))
    throw new DomainError("invalid_owner_application", 422);
}

// A verified account applies for owner access, or reapplies after a decline.
// Owner terms acceptance is added when approved owner terms exist (D15).
export async function applyForOwnerAccess(
  db: D1Database,
  actor: Actor,
  key: string,
  input: Record<string, unknown>,
) {
  await verified(db, actor);
  exactFields(input, ["businessName", "phone", "province"]);
  const businessName = text(input.businessName, 1, 200);
  const phone = text(input.phone, 6, 40);
  if (!/^[+0-9 ()-]+$/.test(phone)) throw new DomainError("invalid_owner_application", 422);
  const province = text(input.province, 1, 100);
  return commitOwnerAccess(db, actor, key, "applicant", { action: "apply", businessName, phone, province }, async () => {
    const current = await db
      .prepare("SELECT status FROM owner_access WHERE user_id=?")
      .bind(actor.id)
      .first<{ status: string }>();
    if (current?.status === "approved") throw new DomainError("owner_access_approved", 409);
    if (current?.status === "pending") throw new DomainError("owner_application_pending", 409);
    return {
      action: "apply",
      from: current ? "declined" : "none",
      businessName,
      phone,
      province,
    };
  });
}

// A different active admin approves or declines a pending application, with a
// reason, against the application revision they reviewed.
export async function decideOwnerApplication(
  db: D1Database,
  actor: Actor,
  key: string,
  subjectId: string,
  input: Record<string, unknown>,
) {
  await requireAdmin(db, actor);
  exactFields(input, ["action", "reason", "revision"]);
  if (input.action !== "approve" && input.action !== "decline")
    throw new DomainError("invalid_owner_application", 422);
  const reason = text(input.reason, 1, 1000);
  if (!Number.isSafeInteger(input.revision) || Number(input.revision) < 1)
    throw new DomainError("invalid_owner_application", 422);
  if (typeof subjectId !== "string" || !/^[A-Za-z0-9_-]{1,128}$/.test(subjectId))
    throw new DomainError("not_found", 404);
  const action = input.action;
  const revision = Number(input.revision);
  return commitOwnerAccess(db, actor, key, "admin", { action, subjectId, reason, revision }, async () => {
    if (subjectId === actor.id) throw new DomainError("not_found", 404);
    const current = await db
      .prepare(
        "SELECT a.status,p.revision FROM owner_access a JOIN owner_application p ON p.user_id=a.user_id WHERE a.user_id=?",
      )
      .bind(subjectId)
      .first<{ status: string; revision: number }>();
    if (!current) throw new DomainError("not_found", 404);
    if (current.status !== "pending" || current.revision !== revision)
      throw new DomainError("stale_owner_application", 409);
    return { action, subjectId, applicationRevision: revision, reason };
  });
}
