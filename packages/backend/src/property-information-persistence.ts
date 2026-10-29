import { operate, assertion, verifiedSQL, type Actor } from "./operations";
import type { PropertyInformationEdit } from "./property-information";
export function commitPropertyInformation(
  db: D1Database,
  actor: Actor,
  key: string,
  propertyId: string,
  fields: PropertyInformationEdit,
) {
  return operate(
    db,
    actor,
    key,
    { kind: "property_information", propertyId, fields },
    (op) => [
      assertion(
        db,
        op,
        `${verifiedSQL} AND EXISTS(SELECT 1 FROM property p JOIN place l ON l.id=p.id WHERE p.id=? AND p.owner_id=? AND l.publication='draft')`,
        [actor.id, propertyId, actor.id],
      ),
      assertion(
        db,
        op,
        "(? IS NULL AND NOT EXISTS(SELECT 1 FROM property_information WHERE property_id=?)) OR EXISTS(SELECT 1 FROM property_information WHERE property_id=? AND revision=?)",
        [fields.revision, propertyId, propertyId, fields.revision],
      ),
      db
        .prepare(
          "INSERT INTO property_information(property_id,description_text,address_text,facilities_json) VALUES (?,?,?,?) ON CONFLICT(property_id) DO UPDATE SET description_text=excluded.description_text,address_text=excluded.address_text,facilities_json=excluded.facilities_json,revision=property_information.revision+1",
        )
        .bind(
          propertyId,
          fields.description,
          fields.address,
          JSON.stringify(fields.facilities),
        ),
      db
        .prepare(
          "INSERT INTO property_information_event(operation_id,property_id,actor_id,revision) SELECT ?,property_id,?,revision FROM property_information WHERE property_id=?",
        )
        .bind(op, actor.id, propertyId),
      db
        .prepare(
          "UPDATE operation SET result_json=(SELECT json_object('id',property_id,'status','updated') FROM property_information_event WHERE operation_id=?) WHERE id=?",
        )
        .bind(op, op),
    ],
    "owner",
  );
}
