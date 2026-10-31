import { DomainError, requireAdmin, type Actor } from "../../shared/index";

// Read-only admin console (ADR 0010, slice 4). Counts and listing states only:
// no guest names, contact details, booking details or private property fields.

export type AdminOverview = {
  pendingOwnerApplications: number;
  pendingPublicationReviews: number;
  approvedOwners: number;
  activeAdmins: number;
  properties: { draft: number; review: number; published: number; paused: number };
};

export async function adminOverview(db: D1Database, actor: Actor): Promise<AdminOverview> {
  await requireAdmin(db, actor);
  const row = await db
    .prepare(
      `SELECT
        (SELECT count(*) FROM owner_access WHERE status='pending') AS pendingOwnerApplications,
        (SELECT count(*) FROM property_review_request WHERE status='pending') AS pendingPublicationReviews,
        (SELECT count(*) FROM owner_access WHERE status='approved') AS approvedOwners,
        (SELECT count(*) FROM platform_staff s JOIN user u ON u.id=s.user_id WHERE s.role='admin' AND s.active=1 AND u.emailVerified=1) AS activeAdmins,
        (SELECT count(*) FROM property p JOIN place l ON l.id=p.id WHERE l.publication='draft') AS draft,
        (SELECT count(*) FROM property p JOIN place l ON l.id=p.id WHERE l.publication='review') AS review,
        (SELECT count(*) FROM property p JOIN place l ON l.id=p.id WHERE l.publication='published') AS published,
        (SELECT count(*) FROM property p JOIN place l ON l.id=p.id WHERE l.publication='paused') AS paused`,
    )
    .first<Record<string, number>>();
  if (!row) throw new DomainError("not_found", 404);
  return {
    pendingOwnerApplications: row.pendingOwnerApplications,
    pendingPublicationReviews: row.pendingPublicationReviews,
    approvedOwners: row.approvedOwners,
    activeAdmins: row.activeAdmins,
    properties: { draft: row.draft, review: row.review, published: row.published, paused: row.paused },
  };
}

export const PUBLICATION_STATES = ["draft", "review", "published", "paused"] as const;
export type PublicationState = (typeof PUBLICATION_STATES)[number];
export type AdminPropertyItem = {
  id: string;
  nameKm: string;
  nameEn: string;
  province: string;
  publication: PublicationState;
  ownerName: string;
  roomTypes: number;
};

// Every property on the platform with its listing state and owner display name,
// ordered by id, optionally filtered by publication state.
export async function adminProperties(
  db: D1Database,
  actor: Actor,
  options: { publication?: string; cursor?: string } = {},
) {
  await requireAdmin(db, actor);
  const publication = options.publication ?? "";
  const cursor = options.cursor ?? "";
  if (publication && !(PUBLICATION_STATES as readonly string[]).includes(publication))
    throw new DomainError("invalid_request", 422);
  if (cursor.length > 128) throw new DomainError("invalid_request", 422);
  const rows = await db
    .prepare(
      `SELECT p.id,l.name_km AS nameKm,l.name_en AS nameEn,l.province,l.publication,o.display_name AS ownerName,
       (SELECT count(*) FROM room_type r WHERE r.property_id=p.id) AS roomTypes
       FROM property p JOIN place l ON l.id=p.id JOIN owner_profile o ON o.user_id=p.owner_id
       WHERE (?='' OR l.publication=?) AND p.id>? ORDER BY p.id LIMIT 21`,
    )
    .bind(publication, publication, cursor)
    .all<AdminPropertyItem>();
  const items = rows.results.slice(0, 20);
  return { items, nextCursor: rows.results.length > 20 ? items.at(-1)!.id : null };
}
