import { verified, type Actor } from "./operations";
import { DomainError } from "./errors";
import { readPublicationReadiness } from "./publication-readiness";
export type ReviewSnapshot = {
  property: {
    id: string;
    ownerId: string;
    ownerName: string;
    nameKm: string;
    nameEn: string;
    province: string;
    revision: number;
    checkinTime: string;
    checkoutTime: string;
    policyText: string;
    termsVersion: string;
    charges: {
      code: string;
      label: string;
      amountCents: number;
    }[];
  };
  information: {
    description: string;
    address: string;
    facilities: string[];
    revision: number | null;
  };
  logistics: {
    latitude: number | null;
    longitude: number | null;
    contactName: string;
    contactPhone: string;
    contactEmail: string;
    arrivalInstructions: string;
    revision: number | null;
  };
  rooms: {
    id: string;
    name: string;
    adultCapacity: number;
    childCapacity: number;
    totalCapacity: number;
    active: number;
    revision: number;
    configuredNights: number;
    calendarEdits: number;
    minPriceCents: number | null;
    maxPriceCents: number | null;
  }[];
  galleryRevision: number | null;
  photos: {
    id: string;
    state: "pending" | "ready";
    width: number | null;
    height: number | null;
  }[];
};
export type ReviewStatus = "pending" | "withdrawn" | "returned" | "approved";
export type ReviewRequest = {
  id: string;
  propertyId: string;
  ownerId: string;
  status: ReviewStatus;
  revision: number;
  submittedAt: number;
  approvedTermsVersion: string | null;
  snapshot: ReviewSnapshot;
};
export type ReviewEvent = {
  action: string;
  actorRole: "owner" | "reviewer";
  reason: string | null;
  occurredAt: number;
};
export type ReviewConfig = {
  reviewerId: string;
  termsVersion: string | null;
  revision: number;
};

// One deterministic read also supplies the commit-time comparison. Stock counters
// are operational data, not a promise made by approving a listing.
export const snapshotSQL = `SELECT json_object(
 'property',json_object('id',p.id,'ownerId',p.owner_id,'ownerName',o.display_name,'nameKm',l.name_km,'nameEn',l.name_en,'province',l.province,'revision',p.revision,'checkinTime',p.checkin_time,'checkoutTime',p.checkout_time,'policyText',p.policy_text,'termsVersion',p.terms_version,'charges',json(p.charges_json)),
 'information',json_object('description',coalesce(i.description_text,''),'address',coalesce(i.address_text,''),'facilities',json(coalesce(i.facilities_json,'[]')),'revision',i.revision),
 'logistics',json_object('latitude',d.latitude,'longitude',d.longitude,'contactName',coalesce(d.contact_name,''),'contactPhone',coalesce(d.contact_phone,''),'contactEmail',coalesce(d.contact_email,''),'arrivalInstructions',coalesce(d.arrival_instructions,''),'revision',d.revision),
 'rooms',json((SELECT json_group_array(json_object('id',r.id,'name',r.name,'adultCapacity',r.adult_capacity,'childCapacity',r.child_capacity,'totalCapacity',r.total_capacity,'active',r.active,'revision',r.revision,
  'calendarEdits',(SELECT count(*) FROM room_calendar_event e WHERE e.room_type_id=r.id),
  'configuredNights',(SELECT count(*) FROM nightly_rate n JOIN inventory_night v ON v.room_type_id=n.room_type_id AND v.night=n.night WHERE n.room_type_id=r.id),
  'minPriceCents',(SELECT min(unit_cents) FROM nightly_rate WHERE room_type_id=r.id),
  'maxPriceCents',(SELECT max(unit_cents) FROM nightly_rate WHERE room_type_id=r.id)))
  FROM (SELECT * FROM room_type WHERE property_id=p.id ORDER BY id LIMIT 101) r)),
 'galleryRevision',g.revision,
 'photos',json((SELECT json_group_array(json_object('id',m.id,'state',m.state,'width',m.width,'height',m.height))
  FROM json_each(coalesce(g.ids_json,'[]')) j JOIN property_media m ON m.id=j.value AND m.property_id=p.id))
 ) FROM property p JOIN place l ON l.id=p.id JOIN owner_profile o ON o.user_id=p.owner_id
 LEFT JOIN property_information i ON i.property_id=p.id LEFT JOIN property_logistics d ON d.property_id=p.id
 LEFT JOIN property_media_gallery g ON g.property_id=p.id WHERE p.id=? AND p.owner_id=?`;
export async function reviewConfig(
  db: D1Database,
): Promise<ReviewConfig | null> {
  return db
    .prepare(
      "SELECT reviewer_user_id AS reviewerId,terms_version AS termsVersion,revision FROM pilot_publication_config WHERE singleton=1",
    )
    .first<ReviewConfig>();
}
export async function canReview(db: D1Database, actor: Actor) {
  await verified(db, actor);
  return !!(await db
    .prepare(
      "SELECT 1 ok FROM pilot_publication_config c JOIN user u ON u.id=c.reviewer_user_id WHERE c.singleton=1 AND u.id=? AND u.emailVerified=1",
    )
    .bind(actor.id)
    .first());
}
export async function requireReviewer(db: D1Database, actor: Actor) {
  if (!(await canReview(db, actor))) throw new DomainError("not_found", 404);
  const config = await reviewConfig(db);
  if (!config || config.reviewerId !== actor.id)
    throw new DomainError("not_found", 404);
  return config;
}
export async function readSnapshot(
  db: D1Database,
  propertyId: string,
  ownerId: string,
) {
  const row = await db
    .prepare("SELECT (" + snapshotSQL + ") AS snapshot")
    .bind(propertyId, ownerId)
    .first<{
      snapshot: string | null;
    }>();
  if (!row?.snapshot) throw new DomainError("not_found", 404);
  return {
    json: row.snapshot,
    data: JSON.parse(row.snapshot) as ReviewSnapshot,
  };
}
type StoredRequest = Omit<ReviewRequest, "snapshot"> & {
  snapshotJson: string;
};
const projection =
  "r.id,r.property_id AS propertyId,r.owner_id AS ownerId,r.status,r.revision,r.submitted_at AS submittedAt,r.approved_terms_version AS approvedTermsVersion,r.snapshot_json AS snapshotJson";
const convert = (row: StoredRequest): ReviewRequest => {
  const { snapshotJson, ...rest } = row;
  return {
    ...rest,
    snapshot: JSON.parse(snapshotJson) as ReviewSnapshot,
  };
};
export async function requestRecord(db: D1Database, id: string) {
  const row = await db
    .prepare(
      "SELECT " +
        projection +
        " FROM property_review_request r JOIN property p ON p.id=r.property_id WHERE r.id=? AND r.owner_id=p.owner_id",
    )
    .bind(id)
    .first<StoredRequest>();
  if (!row) throw new DomainError("not_found", 404);
  return convert(row);
}
export async function reviewEvents(db: D1Database, requestId: string) {
  return (
    await db
      .prepare(
        "SELECT action,actor_role AS actorRole,reason,occurred_at AS occurredAt FROM property_review_event WHERE request_id=? ORDER BY occurred_at,rowid",
      )
      .bind(requestId)
      .all<ReviewEvent>()
  ).results;
}
export async function ownerPublication(
  db: D1Database,
  actor: Actor,
  propertyId: string,
) {
  await verified(db, actor);
  const property = await db
    .prepare(
      "SELECT p.revision,l.publication FROM property p JOIN place l ON l.id=p.id WHERE p.id=? AND p.owner_id=?",
    )
    .bind(propertyId, actor.id)
    .first<{
      revision: number;
      publication: "draft" | "review" | "published" | "paused";
    }>();
  if (!property) throw new DomainError("not_found", 404);
  const row = await db
    .prepare(
      "SELECT " +
        projection +
        " FROM property_review_request r JOIN property p ON p.id=r.property_id WHERE p.id=? AND p.owner_id=? AND r.owner_id=? ORDER BY r.sequence DESC LIMIT 1",
    )
    .bind(propertyId, actor.id, actor.id)
    .first<StoredRequest>();
  const latest = row ? convert(row) : null;
  const draft =
    property.publication === "draft"
      ? (await readSnapshot(db, propertyId, actor.id)).data
      : null;
  const config = await reviewConfig(db);
  const reviewerConfigured =
    !!config &&
    !!(await db
      .prepare("SELECT 1 ok FROM user WHERE id=? AND emailVerified=1")
      .bind(config.reviewerId)
      .first());
  const events = latest ? await reviewEvents(db, latest.id) : [];
  const readiness = await readPublicationReadiness(db, propertyId, actor.id);
  await verified(db, actor);
  // Ownership is also checked by each scoped read; recheck after composing them.
  if (
    !(await db
      .prepare("SELECT 1 ok FROM property WHERE id=? AND owner_id=?")
      .bind(propertyId, actor.id)
      .first())
  )
    throw new DomainError("not_found", 404);
  return {
    propertyRevision: property.revision,
    publication: property.publication,
    draft,
    latest,
    events,
    reviewerConfigured,
    termsConfigured: !!config?.termsVersion,
    readiness,
  };
}
export type OwnerPublication = Awaited<ReturnType<typeof ownerPublication>>;
export async function reviewQueue(db: D1Database, actor: Actor, cursor = "") {
  await requireReviewer(db, actor);
  if (
    cursor &&
    (!/^\d{1,15}$/.test(cursor) || !Number.isSafeInteger(Number(cursor)))
  )
    throw new DomainError("invalid_request", 422);
  const rows = (
    await db
      .prepare(
        "SELECT r.id,r.sequence,r.property_id AS propertyId,r.submitted_at AS submittedAt,json_extract(r.snapshot_json,'$.property.nameKm') AS nameKm,json_extract(r.snapshot_json,'$.property.province') AS province FROM property_review_request r JOIN property p ON p.id=r.property_id JOIN place l ON l.id=p.id WHERE r.status='pending' AND l.publication='review' AND r.owner_id=p.owner_id AND r.sequence>? ORDER BY r.sequence LIMIT 21",
      )
      .bind(cursor ? Number(cursor) : 0)
      .all<{
        id: string;
        sequence: number;
        propertyId: string;
        submittedAt: number;
        nameKm: string;
        province: string;
      }>()
  ).results;
  await requireReviewer(db, actor);
  const items = rows.slice(0, 20);
  return {
    items,
    nextCursor: rows.length > 20 ? String(items.at(-1)!.sequence) : null,
  };
}
export async function reviewDetails(db: D1Database, actor: Actor, id: string) {
  const config = await requireReviewer(db, actor);
  const request = await requestRecord(db, id);
  const place = await db
    .prepare("SELECT publication FROM place WHERE id=?")
    .bind(request.propertyId)
    .first<{
      publication: string;
    }>();
  if (request.status !== "pending" || place?.publication !== "review")
    throw new DomainError("not_found", 404);
  const events = await reviewEvents(db, id);
  const readiness = await readPublicationReadiness(
    db,
    request.propertyId,
    request.ownerId,
  );
  await requireReviewer(db, actor);
  return {
    request,
    events,
    termsVersion: config.termsVersion,
    configRevision: config.revision,
    readiness,
  };
}
export async function reviewPhotoAsset(
  db: D1Database,
  actor: Actor,
  requestId: string,
  photoId: string,
) {
  await verified(db, actor);
  const asset = await db
    .prepare(
      "SELECT m.id,m.property_id FROM property_review_request r JOIN property p ON p.id=r.property_id JOIN place l ON l.id=p.id JOIN property_media m ON m.property_id=p.id WHERE r.id=? AND m.id=? AND r.status='pending' AND l.publication='review' AND r.owner_id=p.owner_id AND m.state='ready' AND (p.owner_id=? OR EXISTS(SELECT 1 FROM pilot_publication_config WHERE singleton=1 AND reviewer_user_id=?)) AND EXISTS(SELECT 1 FROM json_each(r.snapshot_json,'$.photos') j WHERE json_extract(j.value,'$.id')=m.id AND json_extract(j.value,'$.state')='ready')",
    )
    .bind(requestId, photoId, actor.id, actor.id)
    .first<{
      id: string;
      property_id: string;
    }>();
  if (!asset) throw new DomainError("not_found", 404);
  return asset;
}
