import { assertion, operate, verifiedSQL, type Actor } from "../../shared/index";
import type { CreateDraft, UpdateDraft } from "./property-drafts";
const receipt = (db: D1Database, op: string) =>
  db
    .prepare(
      "UPDATE operation SET result_json=(SELECT json_object('id',property_id,'status','draft') FROM property_draft_event WHERE operation_id=?) WHERE id=?",
    )
    .bind(op, op);
export function commitCreateDraft(
  db: D1Database,
  actor: Actor,
  key: string,
  fields: CreateDraft,
) {
  return operate(
    db,
    actor,
    key,
    { kind: "property_draft_create", fields },
    (op) => {
      const id = crypto.randomUUID();
      return [
        assertion(db, op, verifiedSQL, [actor.id]),
        db
          .prepare(
            "INSERT INTO owner_profile(user_id,display_name) VALUES (?,?) ON CONFLICT(user_id) DO NOTHING",
          )
          .bind(actor.id, fields.ownerName),
        db
          .prepare(
            "INSERT INTO place(id,name_km,name_en,province,publication) VALUES (?,?,?,?,'draft')",
          )
          .bind(id, fields.nameKm, fields.nameEn, fields.province),
        db
          .prepare(
            "INSERT INTO property(id,owner_id,checkin_time,checkout_time,policy_version,policy_text,terms_version) VALUES (?,?,?,?,?,?,'unconfigured')",
          )
          .bind(
            id,
            actor.id,
            fields.checkinTime,
            fields.checkoutTime,
            op,
            fields.policyText,
          ),
        db
          .prepare(
            "INSERT INTO property_draft_event(operation_id,property_id,actor_id,kind,revision) VALUES (?,?,?,'created',1)",
          )
          .bind(op, id, actor.id),
        receipt(db, op),
      ];
    },
    "owner",
  );
}
export function commitUpdateDraft(
  db: D1Database,
  actor: Actor,
  key: string,
  id: string,
  fields: UpdateDraft,
) {
  return operate(
    db,
    actor,
    key,
    { kind: "property_draft_update", id, fields },
    (op) => [
      assertion(
        db,
        op,
        `${verifiedSQL} AND EXISTS(SELECT 1 FROM property p JOIN place l ON l.id=p.id WHERE p.id=? AND p.owner_id=? AND p.revision=? AND l.publication='draft')`,
        [actor.id, id, actor.id, fields.revision],
      ),
      db
        .prepare("UPDATE place SET name_km=?,name_en=?,province=? WHERE id=?")
        .bind(fields.nameKm, fields.nameEn, fields.province, id),
      // Existing revision_property increments once, including name-only saves.
      db
        .prepare(
          "UPDATE property SET checkin_time=?,checkout_time=?,policy_version=?,policy_text=? WHERE id=? AND owner_id=? AND revision=?",
        )
        .bind(
          fields.checkinTime,
          fields.checkoutTime,
          op,
          fields.policyText,
          id,
          actor.id,
          fields.revision,
        ),
      assertion(db, op, "changes()=1"),
      db
        .prepare(
          "INSERT INTO property_draft_event(operation_id,property_id,actor_id,kind,revision) VALUES (?,?,?,'updated',?)",
        )
        .bind(op, id, actor.id, fields.revision + 1),
      receipt(db, op),
    ],
    "owner",
  );
}
