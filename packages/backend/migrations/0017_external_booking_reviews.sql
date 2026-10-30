-- Saved owner reviews for existing anonymous catalog-priced external allocations.
-- No backfill or guest contact/negotiated-price policy.
CREATE TABLE external_booking_attempt (
 id TEXT NOT NULL PRIMARY KEY CHECK(length(id)=36),
 actor_id TEXT NOT NULL REFERENCES user(id) ON DELETE RESTRICT,
 property_id TEXT NOT NULL REFERENCES property(id) ON DELETE RESTRICT,
 fingerprint TEXT NOT NULL,
 input_json TEXT NOT NULL CHECK(json_valid(input_json) AND length(input_json)<=32768),
 quote_hash TEXT NOT NULL CHECK(length(quote_hash)=64),
 preview_json TEXT NOT NULL CHECK(json_valid(preview_json) AND length(preview_json)<=262144),
 operation_fingerprint TEXT NOT NULL,
 created_at INTEGER NOT NULL DEFAULT(unixepoch()),
 CHECK(json_extract(input_json,'$.propertyId') IS property_id)
);
CREATE INDEX external_booking_attempt_owner ON external_booking_attempt(actor_id,property_id,created_at,id);
CREATE TRIGGER external_booking_attempt_context BEFORE INSERT ON external_booking_attempt
BEGIN
 SELECT RAISE(ABORT,'invalid_external_review_owner') WHERE NOT EXISTS(
 SELECT 1 FROM property p JOIN user u ON u.id=p.owner_id AND u.emailVerified=1
 WHERE p.id=NEW.property_id AND p.owner_id=NEW.actor_id);
END;
CREATE TRIGGER external_booking_attempt_immutable_update BEFORE UPDATE ON external_booking_attempt BEGIN SELECT RAISE(ABORT,'immutable_external_review'); END;
CREATE TRIGGER external_booking_attempt_immutable_delete BEFORE DELETE ON external_booking_attempt BEGIN SELECT RAISE(ABORT,'retained_external_review'); END;
-- Fence the UI operation-key namespace even when the older direct API is used.
CREATE TRIGGER external_booking_attempt_commit BEFORE INSERT ON booking
WHEN EXISTS(SELECT 1 FROM operation WHERE id=NEW.last_operation_id AND substr(key,1,17)='external-request:')
BEGIN
 SELECT RAISE(ABORT,'invalid_external_review') WHERE NOT EXISTS(
 SELECT 1 FROM operation o JOIN external_booking_attempt a ON o.key='external-request:'||a.id
 WHERE NEW.source='external' AND o.id=NEW.last_operation_id AND o.principal='user:'||a.actor_id
 AND o.actor_id=a.actor_id AND o.actor_role='owner' AND o.fingerprint=a.operation_fingerprint
 AND a.property_id=NEW.property_id);
END;
