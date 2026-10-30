import { verified, type Actor } from "./operations";
import { DomainError } from "./errors";
import { approvedListingFrom, approvedListingConditions } from "./catalog-queries";
import { publicSourceSQL, verifiedPublicProjection } from "./public-listing";
export async function listingState(db: D1Database, actor: Actor, propertyId: string) {
  await verified(db, actor);
  const row = await db.prepare(`SELECT l.publication,
    coalesce((SELECT max(revision) FROM listing_control_event WHERE property_id=p.id),0) AS revision,
    (SELECT id FROM property_review_request WHERE property_id=p.id ORDER BY sequence DESC LIMIT 1) AS reviewId
    FROM property p JOIN place l ON l.id=p.id JOIN user u ON u.id=p.owner_id AND u.emailVerified=1
    WHERE p.id=? AND p.owner_id=?`).bind(propertyId, actor.id)
    .first<{publication: string; revision: number; reviewId: string | null}>();
  if (!row) throw new DomainError("not_found",404);
  return row;
}
export async function resumeApproval(db: D1Database, actor: Actor, propertyId: string, reviewId: string | null) {
  await verified(db, actor);
  if (!reviewId) return false;
  const row=await db.prepare(`SELECT d.preview_hash AS hash,${publicSourceSQL} AS source ${approvedListingFrom}
    WHERE l.publication='paused' AND ${approvedListingConditions} AND p.id=? AND p.owner_id=? AND r.id=?
    AND NOT EXISTS(SELECT 1 FROM json_each(r.snapshot_json,'$.photos') j
      LEFT JOIN property_media m ON m.id=json_extract(j.value,'$.id') AND m.property_id=p.id
      WHERE json_extract(j.value,'$.state')='ready' AND coalesce(m.state,'missing')<>'ready')`)
    .bind(propertyId,actor.id,reviewId).first<{hash:string;source:string}>();
  return !!row && !!await verifiedPublicProjection(row.source,row.hash);
}
export async function listingControls(db:D1Database,actor:Actor,propertyId:string) {
  const state=await listingState(db,actor,propertyId);
  const history=(await db.prepare(`SELECT e.revision,e.action,e.from_state AS fromState,e.to_state AS toState,e.occurred_at AS occurredAt,
    e.actor_id AS actorId,e.review_id AS reviewId FROM listing_control_event e
    JOIN property p ON p.id=e.property_id JOIN user u ON u.id=p.owner_id AND u.emailVerified=1
    WHERE p.id=? AND p.owner_id=? ORDER BY e.revision DESC LIMIT 20`).bind(propertyId,actor.id)
    .all<{revision:number;action:string;fromState:string;toState:string;occurredAt:number;actorId:string;reviewId:string|null}>()).results;
  const last=history[0];
  const ownerPaused=state.publication==="paused" && last?.action==="pause" &&
    last.actorId===actor.id && last.reviewId===state.reviewId;
  const canResume=!!ownerPaused && await resumeApproval(db,actor,propertyId,state.reviewId);
  const current=await listingState(db,actor,propertyId);
  if (current.revision!==state.revision || current.publication!==state.publication || current.reviewId!==state.reviewId)
    throw new DomainError("listing_conflict");
  return {...state,canPause:state.publication==="published",canResume,canReopen:!!ownerPaused,
    correctionDraft:state.publication==="draft"&&last?.action==="reopen",ownerPaused:!!ownerPaused,
    history:history.map(({actorId:_actor,reviewId:_review,...event})=>event)};
}
export type ListingControls=Awaited<ReturnType<typeof listingControls>>;
