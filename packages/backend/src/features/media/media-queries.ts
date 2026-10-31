import { verified, type Actor } from "../../shared/index";
import { DomainError } from "../../shared/index";

export type MediaAsset = {
  id: string;
  property_id: string;
  content_type: "image/jpeg" | "image/png" | "image/webp";
  byte_size: number;
  sha256: string;
  state: "pending" | "ready" | "removed";
  width: number | null;
  height: number | null;
};
export type MediaGallery = {
  revision: number | null;
  photos: {
    id: string;
    state: "pending" | "ready";
    width: number | null;
    height: number | null;
  }[];
};
export async function requireMediaOwner(
  db: D1Database,
  actor: Actor,
  propertyId: string,
) {
  await verified(db, actor);
  const property = await db
    .prepare(
      "SELECT p.id FROM property p JOIN place l ON l.id=p.id WHERE p.id=? AND p.owner_id=? AND l.publication='draft'",
    )
    .bind(propertyId, actor.id)
    .first();
  if (!property) throw new DomainError("not_found", 404);
}
export async function ownerMediaGallery(
  db: D1Database,
  actor: Actor,
  propertyId: string,
): Promise<MediaGallery> {
  await requireMediaOwner(db, actor, propertyId);
  // One snapshot for ordering, revision and states, including an absent gallery.
  const rows = (
    await db
      .prepare(
        "SELECT g.revision,m.id,m.state,m.width,m.height FROM property p JOIN place l ON l.id=p.id JOIN user u ON u.id=p.owner_id LEFT JOIN property_media_gallery g ON g.property_id=p.id LEFT JOIN json_each(g.ids_json) j LEFT JOIN property_media m ON m.id=j.value AND m.property_id=p.id AND m.state<>'removed' WHERE p.id=? AND p.owner_id=? AND u.emailVerified=1 AND l.publication='draft' ORDER BY CAST(j.key AS INTEGER) LIMIT 20",
      )
      .bind(propertyId, actor.id)
      .all<{
        revision: number | null;
        id: string | null;
        state: "pending" | "ready";
        width: number | null;
        height: number | null;
      }>()
  ).results;
  if (!rows.length) throw new DomainError("not_found", 404);
  return {
    revision: rows[0].revision,
    photos: rows.flatMap((r) =>
      r.id
        ? [{ id: r.id, state: r.state, width: r.width, height: r.height }]
        : [],
    ),
  };
}
export async function ownerMediaAsset(
  db: D1Database,
  actor: Actor,
  propertyId: string,
  id: string,
) {
  await requireMediaOwner(db, actor, propertyId);
  const row = await db
    .prepare(
      "SELECT m.* FROM property_media m JOIN property p ON p.id=m.property_id JOIN place l ON l.id=p.id JOIN user u ON u.id=p.owner_id WHERE m.id=? AND m.property_id=? AND p.owner_id=? AND u.emailVerified=1 AND l.publication='draft'",
    )
    .bind(id, propertyId, actor.id)
    .first<MediaAsset>();
  if (!row) throw new DomainError("not_found", 404);
  return row;
}
// Keys never come from a filename, URL or client-provided object key.
export function mediaKeys(asset: Pick<MediaAsset, "id" | "property_id">) {
  const prefix = `private/properties/${asset.property_id}/photos/${asset.id}/`;
  return { original: prefix + "original", preview: prefix + "preview-v1.jpg" };
}
