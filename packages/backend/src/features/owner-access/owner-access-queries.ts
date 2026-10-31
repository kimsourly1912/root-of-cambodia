import { DomainError, requireAdmin, verified, type Actor } from "../../shared/index";

export type OwnerAccessStatus = {
  status: "none" | "pending" | "approved" | "declined";
  source: "backfill" | "application" | null;
  application: {
    businessName: string;
    phone: string;
    province: string;
    revision: number;
    submittedAt: number;
  } | null;
  // The admin's reason, shown to the applicant after a decline.
  declineReason: string | null;
  decidedAt: number | null;
};

// The signed-in account's own owner access and application.
export async function ownerAccessStatus(db: D1Database, actor: Actor): Promise<OwnerAccessStatus> {
  await verified(db, actor);
  const row = await db
    .prepare(
      `SELECT a.status,a.source,a.decided_at AS decidedAt,p.business_name AS businessName,p.phone,p.province,
       p.revision,p.submitted_at AS submittedAt,
       (SELECT reason FROM owner_access_command WHERE subject_id=a.user_id AND action='decline' AND result_json IS NOT NULL
        ORDER BY occurred_at DESC,rowid DESC LIMIT 1) AS declineReason
       FROM owner_access a LEFT JOIN owner_application p ON p.user_id=a.user_id WHERE a.user_id=?`,
    )
    .bind(actor.id)
    .first<{
      status: OwnerAccessStatus["status"];
      source: "backfill" | "application";
      decidedAt: number | null;
      businessName: string | null;
      phone: string;
      province: string;
      revision: number;
      submittedAt: number;
      declineReason: string | null;
    }>();
  if (!row) return { status: "none", source: null, application: null, declineReason: null, decidedAt: null };
  return {
    status: row.status,
    source: row.source,
    application:
      row.businessName === null
        ? null
        : {
            businessName: row.businessName,
            phone: row.phone,
            province: row.province,
            revision: row.revision,
            submittedAt: row.submittedAt,
          },
    declineReason: row.status === "declined" ? row.declineReason : null,
    decidedAt: row.decidedAt,
  };
}

export type OwnerApplicationItem = {
  userId: string;
  accountName: string;
  accountEmail: string;
  businessName: string;
  phone: string;
  province: string;
  revision: number;
  submittedAt: number;
};

// Admin queue of pending applications, oldest first. Only the applicant's own
// submitted details and account identity; no guest or booking data.
export async function ownerApplications(db: D1Database, actor: Actor, cursor = "") {
  await requireAdmin(db, actor);
  const match = cursor ? /^(\d{1,12}):([A-Za-z0-9_-]{1,128})$/.exec(cursor) : null;
  if (cursor && !match) throw new DomainError("invalid_request", 422);
  const rows = await db
    .prepare(
      `SELECT p.user_id AS userId,u.name AS accountName,u.email AS accountEmail,p.business_name AS businessName,
       p.phone,p.province,p.revision,p.submitted_at AS submittedAt
       FROM owner_access a JOIN owner_application p ON p.user_id=a.user_id JOIN user u ON u.id=a.user_id
       WHERE a.status='pending' AND (?=0 OR p.submitted_at>? OR (p.submitted_at=? AND p.user_id>?))
       ORDER BY p.submitted_at,p.user_id LIMIT 21`,
    )
    .bind(match ? 1 : 0, Number(match?.[1] ?? 0), Number(match?.[1] ?? 0), match?.[2] ?? "")
    .all<OwnerApplicationItem>();
  const items = rows.results.slice(0, 20);
  const last = items.at(-1);
  return {
    items,
    nextCursor: rows.results.length > 20 && last ? `${last.submittedAt}:${last.userId}` : null,
  };
}
