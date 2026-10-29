import { DomainError } from "./errors";
import { mediaKeys } from "./media-queries";
import {
  PUBLIC_DISCLOSURE_VERSION,
  publicSourceSQL,
  verifiedPublicProjection,
  type PublicListing,
} from "./public-listing";

// Approved history remains valid after a reviewer reassignment. Calendar dates
// and free-stock counters deliberately do not decide catalog visibility.
const eligibleFrom = `FROM property_review_request r
 JOIN property p ON p.id=r.property_id JOIN place l ON l.id=p.id
 JOIN user u ON u.id=p.owner_id
 JOIN public_listing_disclosure d ON d.request_id=r.id AND d.owner_id=p.owner_id`;
const eligibleWhere = ` WHERE l.publication='published' AND u.emailVerified=1 AND r.owner_id=p.owner_id
 AND r.status='approved' AND p.terms_version=r.approved_terms_version
 AND d.policy_version='${PUBLIC_DISCLOSURE_VERSION}'
 AND r.sequence=(SELECT max(latest.sequence) FROM property_review_request latest WHERE latest.property_id=p.id)`;
const eligibleSQL = eligibleFrom + eligibleWhere;
const projectionSQL = `SELECT p.id,r.id AS requestId,d.preview_hash AS previewHash,${publicSourceSQL} AS publicSource ${eligibleSQL}`;
type PublicRow = {
  id: string;
  requestId: string;
  previewHash: string;
  publicSource: string;
};
export type BrowseInput = { q: string; province: string; cursor: string };
export function browseInput(input: Record<string, unknown>): BrowseInput {
  if (
    Object.keys(input).some((key) => !["q", "province", "cursor"].includes(key))
  )
    throw new DomainError("invalid_request", 422);
  const text = (key: string) => {
    const value = input[key] ?? "";
    if (
      typeof value !== "string" ||
      value.length > 100 ||
      /[\u0000-\u001f\u007f]/.test(value)
    )
      throw new DomainError("invalid_request", 422);
    return value.trim();
  };
  const q = text("q"),
    province = text("province"),
    cursor = input.cursor ?? "";
  // A cursor is only an already-public property identifier, not a private
  // review sequence, encoded private history or authorization credential.
  if (
    typeof cursor !== "string" ||
    (cursor && !/^[A-Za-z0-9_-]{1,128}$/.test(cursor))
  )
    throw new DomainError("invalid_request", 422);
  return { q, province, cursor };
}
const pattern = (value: string) => "%" + value.replace(/[!%_]/g, "!$&") + "%";
async function stillEligible(db: D1Database, rows: PublicRow[]) {
  if (!rows.length) return new Set<string>();
  const current = await db
    .prepare(
      "SELECT r.id " +
        eligibleSQL +
        " AND r.id IN (" +
        rows.map(() => "?").join(",") +
        ")",
    )
    .bind(...rows.map((row) => row.requestId))
    .all<{ id: string }>();
  return new Set(current.results.map((row) => row.id));
}
export async function browseStays(
  db: D1Database,
  raw: Record<string, unknown> = {},
) {
  const input = browseInput(raw);
  const rows = (
    await db
      .prepare(
        projectionSQL +
          ` AND p.id>?
   AND (?='' OR json_extract(r.snapshot_json,'$.property.province')=? COLLATE NOCASE)
   AND (?='' OR json_extract(r.snapshot_json,'$.property.nameKm') LIKE ? ESCAPE '!' OR json_extract(r.snapshot_json,'$.property.nameEn') LIKE ? ESCAPE '!')
   ORDER BY p.id LIMIT 21`,
      )
      .bind(
        input.cursor,
        input.province,
        input.province,
        input.q,
        pattern(input.q),
        pattern(input.q),
      )
      .all<PublicRow>()
  ).results;
  const page = rows.slice(0, 20);
  const checked = await Promise.all(
    page.map(async (row) => ({
      row,
      listing: await verifiedPublicProjection(
        row.publicSource,
        row.previewHash,
      ),
    })),
  );
  const current = await stillEligible(db, page);
  const items = checked.flatMap(({ row, listing }) =>
    listing && current.has(row.requestId)
      ? [
          {
            id: listing.id,
            nameKm: listing.nameKm,
            nameEn: listing.nameEn,
            province: listing.province,
            cover: listing.photos[0] ?? null,
          },
        ]
      : [],
  );
  return {
    items,
    nextCursor: rows.length > 20 ? (items.at(-1)?.id ?? null) : null,
  };
}
async function listingRecord(
  db: D1Database,
  id: string,
): Promise<{ listing: PublicListing; requestId: string }> {
  if (!/^[A-Za-z0-9_-]{1,128}$/.test(id))
    throw new DomainError("not_found", 404);
  const row = await db
    .prepare(projectionSQL + " AND p.id=?")
    .bind(id)
    .first<PublicRow>();
  if (!row) throw new DomainError("not_found", 404);
  const listing = await verifiedPublicProjection(
    row.publicSource,
    row.previewHash,
  );
  if (!listing || !(await stillEligible(db, [row])).has(row.requestId))
    throw new DomainError("not_found", 404);
  return { listing, requestId: row.requestId };
}
export async function publicStay(db: D1Database, id: string) {
  return (await listingRecord(db, id)).listing;
}
async function publicPhoto(db: D1Database, id: string, photoId: string) {
  if (
    !/^[A-Za-z0-9_-]{1,128}$/.test(id) ||
    !/^[A-Za-z0-9_-]{1,128}$/.test(photoId)
  )
    throw new DomainError("not_found", 404);
  // Check state, owner, approved membership and ready metadata together. One
  // bounded read on each side of R2 avoids separate per-photo scope lookups.
  const row = await db
    .prepare(
      `SELECT m.id,m.property_id,r.id AS requestId,d.preview_hash AS previewHash,${publicSourceSQL} AS publicSource ` +
        eligibleFrom +
        " JOIN property_media m ON m.property_id=p.id " +
        eligibleWhere +
        " AND p.id=? AND m.id=? AND m.state='ready' AND EXISTS(SELECT 1 FROM json_each(r.snapshot_json,'$.photos') j WHERE json_extract(j.value,'$.id')=m.id AND json_extract(j.value,'$.state')='ready')",
    )
    .bind(id, photoId)
    .first<PublicRow & { property_id: string }>();
  if (
    !row ||
    !(await verifiedPublicProjection(row.publicSource, row.previewHash))
  )
    throw new DomainError("not_found", 404);
  return { id: row.id, property_id: row.property_id, requestId: row.requestId };
}
export async function readPublicPhoto(
  db: D1Database,
  store: Pick<R2Bucket, "get">,
  id: string,
  photoId: string,
) {
  const before = await publicPhoto(db, id, photoId);
  const object = await store.get(mediaKeys(before).preview);
  const after = await publicPhoto(db, id, photoId);
  if (before.requestId !== after.requestId)
    throw new DomainError("not_found", 404);
  if (!object) throw new DomainError("photo_processing_unavailable", 503);
  return object.body;
}
