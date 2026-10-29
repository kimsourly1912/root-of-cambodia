import { DomainError } from "./errors";

// One set of predicates drives scoped guidance and the atomic submit/approval
// guards. Calendar eligibility uses D1 time and Cambodia's fixed UTC+7 schedule;
// neither reservations nor blocks are listing-completeness requirements.
export const calendarReadinessSQL = `EXISTS(
 SELECT 1 FROM room_type r JOIN nightly_rate n ON n.room_type_id=r.id
 JOIN inventory_night v ON v.room_type_id=r.id AND v.night=n.night
 WHERE r.property_id=p.id AND r.active=1 AND v.capacity>0
 AND n.night>=date(unixepoch()+86400,'unixepoch','+7 hours')
 AND unixepoch(n.night||'T'||p.checkin_time||':00+07:00')>=unixepoch()+86400
)`;
const requirements = {
  basics: `u.emailVerified=1 AND length(trim(o.display_name))>0
   AND length(trim(l.name_km))>0 AND length(trim(l.province))>0
   AND length(trim(p.policy_text))>0
   AND (p.checkin_time GLOB '[01][0-9]:[0-5][0-9]' OR p.checkin_time GLOB '2[0-3]:[0-5][0-9]')
   AND (p.checkout_time GLOB '[01][0-9]:[0-5][0-9]' OR p.checkout_time GLOB '2[0-3]:[0-5][0-9]')`,
  description: "length(trim(coalesce(i.description_text,'')))>0",
  address: "length(trim(coalesce(i.address_text,'')))>0",
  contact:
    "length(trim(coalesce(d.contact_phone,'')))>0 OR length(trim(coalesce(d.contact_email,'')))>0",
  photos: `EXISTS(SELECT 1 FROM json_each(coalesce(g.ids_json,'[]')) j
   JOIN property_media m ON m.id=j.value AND m.property_id=p.id WHERE m.state='ready')`,
  uploads: `NOT EXISTS(SELECT 1 FROM json_each(coalesce(g.ids_json,'[]')) j
   LEFT JOIN property_media m ON m.id=j.value AND m.property_id=p.id WHERE coalesce(m.state,'missing')<>'ready')`,
  rooms:
    "EXISTS(SELECT 1 FROM room_type r WHERE r.property_id=p.id AND r.active=1)",
  calendar: calendarReadinessSQL,
} as const;
export type ReadinessItem = keyof typeof requirements;
export type PublicationReadiness = {
  ready: boolean;
  missing: ReadinessItem[];
  checks: Record<ReadinessItem, boolean>;
};
const sourceSQL = `FROM property p JOIN place l ON l.id=p.id
 JOIN user u ON u.id=p.owner_id JOIN owner_profile o ON o.user_id=p.owner_id
 LEFT JOIN property_information i ON i.property_id=p.id
 LEFT JOIN property_logistics d ON d.property_id=p.id
 LEFT JOIN property_media_gallery g ON g.property_id=p.id
 WHERE p.id=? AND p.owner_id=?`;
export const publicationReadySQL =
  "SELECT 1 " +
  sourceSQL +
  " AND " +
  Object.values(requirements)
    .map((sql) => "(" + sql + ")")
    .join(" AND ");
const readSQL =
  "SELECT " +
  Object.entries(requirements)
    .map(([code, sql]) => `coalesce((${sql}),0) AS ${code}`)
    .join(",") +
  " " +
  sourceSQL;

// Internal read: callers must first verify the current owner or configured
// reviewer, supply the scoped property/owner pair, and recheck access afterward.
export async function readPublicationReadiness(
  db: D1Database,
  propertyId: string,
  ownerId: string,
): Promise<PublicationReadiness> {
  const row = await db
    .prepare(readSQL)
    .bind(propertyId, ownerId)
    .first<Record<ReadinessItem, number>>();
  if (!row) throw new DomainError("not_found", 404);
  const keys = Object.keys(requirements) as ReadinessItem[];
  const checks = Object.fromEntries(
    keys.map((key) => [key, row[key] === 1]),
  ) as Record<ReadinessItem, boolean>;
  const missing = keys.filter((key) => !checks[key]);
  return { ready: missing.length === 0, missing, checks };
}

export async function requirePublicationReadiness(
  db: D1Database,
  propertyId: string,
  ownerId: string,
) {
  if (!(await readPublicationReadiness(db, propertyId, ownerId)).ready)
    throw new DomainError("publication_incomplete", 422);
}
