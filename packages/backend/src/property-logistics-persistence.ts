import { operate, assertion, verifiedSQL, type Actor } from "./operations";
import type { PropertyLogisticsEdit } from "./property-logistics";
export function commitPropertyLogistics(
  db: D1Database,
  actor: Actor,
  key: string,
  propertyId: string,
  fields: PropertyLogisticsEdit,
) {
  return operate(
    db,
    actor,
    key,
    { kind: "property_logistics", propertyId, fields },
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
        "(? IS NULL AND NOT EXISTS(SELECT 1 FROM property_logistics WHERE property_id=?)) OR EXISTS(SELECT 1 FROM property_logistics WHERE property_id=? AND revision=?)",
        [fields.revision, propertyId, propertyId, fields.revision],
      ),
      db
        .prepare(
          "INSERT INTO property_logistics(property_id,latitude,longitude,contact_name,contact_phone,contact_email,arrival_instructions) VALUES (?,?,?,?,?,?,?) ON CONFLICT(property_id) DO UPDATE SET latitude=excluded.latitude,longitude=excluded.longitude,contact_name=excluded.contact_name,contact_phone=excluded.contact_phone,contact_email=excluded.contact_email,arrival_instructions=excluded.arrival_instructions,revision=property_logistics.revision+1",
        )
        .bind(
          propertyId,
          fields.latitude,
          fields.longitude,
          fields.contactName,
          fields.contactPhone,
          fields.contactEmail,
          fields.arrivalInstructions,
        ),
      db
        .prepare(
          "INSERT INTO property_logistics_event(operation_id,property_id,actor_id,revision) SELECT ?,property_id,?,revision FROM property_logistics WHERE property_id=?",
        )
        .bind(op, actor.id, propertyId),
      db
        .prepare(
          "UPDATE operation SET result_json=(SELECT json_object('id',property_id,'status','updated') FROM property_logistics_event WHERE operation_id=?) WHERE id=?",
        )
        .bind(op, op),
    ],
    "owner",
  );
}
