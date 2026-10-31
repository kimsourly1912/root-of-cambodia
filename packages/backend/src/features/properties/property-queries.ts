import { verified, type Actor } from "../../shared/index";
import { DomainError } from "../../shared/index";
export type OwnerProperty = {
  id: string;
  nameKm: string;
  nameEn: string;
  province: string;
  checkinTime: string;
  checkoutTime: string;
  policyText: string;
  revision: number;
  publication: "draft" | "review" | "published" | "paused";
};
const projection = `p.id,l.name_km AS nameKm,l.name_en AS nameEn,l.province,p.checkin_time AS checkinTime,p.checkout_time AS checkoutTime,p.policy_text AS policyText,p.revision,l.publication`;
export async function ownerProfile(db: D1Database, actor: Actor) {
  const user = await verified(db, actor);
  const profile = await db
    .prepare(
      "SELECT display_name AS displayName FROM owner_profile WHERE user_id=?",
    )
    .bind(actor.id)
    .first<{ displayName: string }>();
  return { displayName: profile?.displayName ?? user.name, exists: !!profile };
}
export async function ownerProperty(db: D1Database, actor: Actor, id: string) {
  await verified(db, actor);
  const property = await db
    .prepare(
      `SELECT ${projection} FROM property p JOIN place l ON l.id=p.id WHERE p.id=? AND p.owner_id=?`,
    )
    .bind(id, actor.id)
    .first<OwnerProperty>();
  if (!property) throw new DomainError("not_found", 404);
  return property;
}
export async function ownerProperties(
  db: D1Database,
  actor: Actor,
  cursor = "",
) {
  await verified(db, actor);
  if (cursor.length > 128) throw new DomainError("invalid_request", 422);
  const rows = await db
    .prepare(
      `SELECT ${projection} FROM property p JOIN place l ON l.id=p.id WHERE p.owner_id=? AND p.id>? ORDER BY p.id LIMIT 21`,
    )
    .bind(actor.id, cursor)
    .all<OwnerProperty>();
  const items = rows.results.slice(0, 20);
  return {
    items,
    nextCursor: rows.results.length > 20 ? items.at(-1)!.id : null,
  };
}
