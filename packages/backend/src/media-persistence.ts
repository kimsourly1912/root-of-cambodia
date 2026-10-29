import { operate, assertion, verifiedSQL, type Actor } from "./operations";

export type UploadDescriptor = {
  contentType: "image/jpeg" | "image/png" | "image/webp";
  byteSize: number;
  sha256: string;
};
const ownerGuard = (
  db: D1Database,
  op: string,
  actor: Actor,
  propertyId: string,
) =>
  assertion(
    db,
    op,
    `${verifiedSQL} AND EXISTS(SELECT 1 FROM property p JOIN place l ON l.id=p.id WHERE p.id=? AND p.owner_id=? AND l.publication='draft')`,
    [actor.id, propertyId, actor.id],
  );
const versionGuard = (
  db: D1Database,
  op: string,
  propertyId: string,
  revision: number | null,
) =>
  assertion(
    db,
    op,
    "(? IS NULL AND NOT EXISTS(SELECT 1 FROM property_media_gallery WHERE property_id=?)) OR EXISTS(SELECT 1 FROM property_media_gallery WHERE property_id=? AND revision=?)",
    [revision, propertyId, propertyId, revision],
  );
function finishMedia(
  db: D1Database,
  op: string,
  actor: Actor,
  propertyId: string,
  id: string,
  status: string,
) {
  return [
    db
      .prepare(
        "INSERT INTO property_media_event(operation_id,property_id,actor_id,revision) SELECT ?,property_id,?,revision FROM property_media_gallery WHERE property_id=?",
      )
      .bind(op, actor.id, propertyId),
    db
      .prepare(
        "UPDATE operation SET result_json=json_object('id',?,'status',?) WHERE id=? AND EXISTS(SELECT 1 FROM property_media_event WHERE operation_id=?)",
      )
      .bind(id, status, op, op),
  ];
}
export function registerMedia(
  db: D1Database,
  actor: Actor,
  key: string,
  propertyId: string,
  revision: number | null,
  fields: UploadDescriptor,
) {
  return operate(
    db,
    actor,
    key,
    { kind: "media_register", propertyId, revision, fields },
    (op) => [
      ownerGuard(db, op, actor, propertyId),
      versionGuard(db, op, propertyId, revision),
      db
        .prepare(
          "INSERT INTO property_media(id,property_id,content_type,byte_size,sha256) VALUES(?,?,?,?,?)",
        )
        .bind(
          op,
          propertyId,
          fields.contentType,
          fields.byteSize,
          fields.sha256,
        ),
      db
        .prepare(
          "INSERT INTO property_media_gallery(property_id,ids_json) VALUES(?,json_array(?)) ON CONFLICT(property_id) DO UPDATE SET ids_json=json_insert(property_media_gallery.ids_json,'$[#]',?),revision=property_media_gallery.revision+1",
        )
        .bind(propertyId, op, op),
      ...finishMedia(db, op, actor, propertyId, op, "pending"),
    ],
    "owner",
  );
}
export function completeMedia(
  db: D1Database,
  actor: Actor,
  key: string,
  propertyId: string,
  id: string,
  width: number,
  height: number,
) {
  return operate(
    db,
    actor,
    key,
    { kind: "media_ready", propertyId, id, width, height },
    (op) => [
      ownerGuard(db, op, actor, propertyId),
      assertion(
        db,
        op,
        "EXISTS(SELECT 1 FROM property_media WHERE id=? AND property_id=? AND state='pending')",
        [id, propertyId],
      ),
      db
        .prepare(
          "UPDATE property_media SET state='ready',width=?,height=? WHERE id=? AND property_id=? AND state='pending'",
        )
        .bind(width, height, id, propertyId),
      db
        .prepare(
          "UPDATE property_media_gallery SET revision=revision+1 WHERE property_id=?",
        )
        .bind(propertyId),
      ...finishMedia(db, op, actor, propertyId, id, "ready"),
    ],
    "owner",
  );
}
export function reorderMedia(
  db: D1Database,
  actor: Actor,
  key: string,
  propertyId: string,
  revision: number,
  ids: string[],
) {
  return operate(
    db,
    actor,
    key,
    { kind: "media_reorder", propertyId, revision, ids },
    (op) => [
      ownerGuard(db, op, actor, propertyId),
      versionGuard(db, op, propertyId, revision),
      db
        .prepare(
          "UPDATE property_media_gallery SET ids_json=?,revision=revision+1 WHERE property_id=?",
        )
        .bind(JSON.stringify(ids), propertyId),
      ...finishMedia(db, op, actor, propertyId, propertyId, "reordered"),
    ],
    "owner",
  );
}
export function removeMedia(
  db: D1Database,
  actor: Actor,
  key: string,
  propertyId: string,
  revision: number,
  id: string,
) {
  return operate(
    db,
    actor,
    key,
    { kind: "media_remove", propertyId, revision, id },
    (op) => [
      ownerGuard(db, op, actor, propertyId),
      versionGuard(db, op, propertyId, revision),
      assertion(
        db,
        op,
        "EXISTS(SELECT 1 FROM property_media WHERE id=? AND property_id=? AND state<>'removed')",
        [id, propertyId],
      ),
      db
        .prepare(
          "UPDATE property_media SET state='removed',cleanup_at=unixepoch() WHERE id=? AND property_id=? AND state<>'removed'",
        )
        .bind(id, propertyId),
      db
        .prepare(
          "UPDATE property_media_gallery SET ids_json=(SELECT json_group_array(value) FROM json_each(ids_json) WHERE value<>?),revision=revision+1 WHERE property_id=?",
        )
        .bind(id, propertyId),
      ...finishMedia(db, op, actor, propertyId, id, "removed"),
    ],
    "owner",
  );
}
