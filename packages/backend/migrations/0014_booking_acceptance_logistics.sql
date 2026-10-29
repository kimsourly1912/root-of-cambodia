-- No backfill: older accepted bookings do not have historical logistics copies.
CREATE TABLE booking_acceptance (
 booking_id TEXT PRIMARY KEY REFERENCES booking(id) ON DELETE RESTRICT,
 operation_id TEXT NOT NULL UNIQUE REFERENCES operation(id) ON DELETE RESTRICT,
 owner_id TEXT NOT NULL REFERENCES user(id) ON DELETE RESTRICT,
 information_revision INTEGER NOT NULL,logistics_revision INTEGER NOT NULL,
 preview_hash TEXT NOT NULL CHECK(length(preview_hash)=64),
 details_json TEXT NOT NULL CHECK(json_valid(details_json)),
 accepted_at INTEGER NOT NULL DEFAULT(unixepoch())
);
CREATE TRIGGER booking_acceptance_context BEFORE INSERT ON booking_acceptance
BEGIN
 SELECT RAISE(ABORT,'invalid_acceptance') WHERE NOT EXISTS(
  SELECT 1 FROM booking b JOIN property p ON p.id=b.property_id
  JOIN property_information i ON i.property_id=p.id JOIN property_logistics d ON d.property_id=p.id
  JOIN user u ON u.id=p.owner_id JOIN operation o ON o.id=NEW.operation_id
  WHERE b.id=NEW.booking_id AND b.status='pending' AND b.expires_at>unixepoch() AND p.owner_id=NEW.owner_id AND u.emailVerified=1
   AND o.principal='user:'||p.owner_id AND o.actor_id=p.owner_id AND o.actor_role='owner' AND o.kind='accept' AND o.result_json IS NULL
   AND NEW.accepted_at=unixepoch() AND i.revision=NEW.information_revision AND d.revision=NEW.logistics_revision
   AND json_extract(NEW.details_json,'$.address') IS i.address_text
   AND json_extract(NEW.details_json,'$.latitude') IS d.latitude AND json_extract(NEW.details_json,'$.longitude') IS d.longitude
   AND json_extract(NEW.details_json,'$.contactName') IS d.contact_name AND json_extract(NEW.details_json,'$.contactPhone') IS d.contact_phone
   AND json_extract(NEW.details_json,'$.contactEmail') IS d.contact_email AND json_extract(NEW.details_json,'$.arrivalInstructions') IS d.arrival_instructions
   AND length(trim(i.address_text,char(9,10,11,12,13,32,160,5760,8192,8193,8194,8195,8196,8197,8198,8199,8200,8201,8202,8232,8233,8239,8287,12288,65279)))>0
   AND (length(trim(d.contact_phone,char(9,10,11,12,13,32,160,5760,8192,8193,8194,8195,8196,8197,8198,8199,8200,8201,8202,8232,8233,8239,8287,12288,65279)))>0 OR length(trim(d.contact_email,char(9,10,11,12,13,32,160,5760,8192,8193,8194,8195,8196,8197,8198,8199,8200,8201,8202,8232,8233,8239,8287,12288,65279)))>0)
 );
END;
CREATE TRIGGER booking_acceptance_immutable_update BEFORE UPDATE ON booking_acceptance BEGIN SELECT RAISE(ABORT,'immutable_acceptance'); END;
CREATE TRIGGER booking_acceptance_immutable_delete BEFORE DELETE ON booking_acceptance BEGIN SELECT RAISE(ABORT,'retained_acceptance'); END;
CREATE TRIGGER booking_acceptance_required BEFORE UPDATE OF status ON booking WHEN OLD.status='pending' AND NEW.status='confirmed' AND EXISTS(SELECT 1 FROM operation WHERE id=NEW.last_operation_id AND kind='accept' AND actor_role='owner')
BEGIN
 SELECT RAISE(ABORT,'invalid_acceptance') WHERE NOT EXISTS(SELECT 1 FROM booking_acceptance a WHERE a.booking_id=NEW.id AND a.operation_id=NEW.last_operation_id);
END;
-- A success receipt cannot seal an unmatched snapshot.
CREATE TRIGGER booking_acceptance_receipt BEFORE UPDATE OF result_json ON operation WHEN NEW.result_json IS NOT NULL AND OLD.result_json IS NULL
BEGIN
 SELECT RAISE(ABORT,'invalid_acceptance_receipt') WHERE EXISTS(SELECT 1 FROM booking_acceptance a JOIN booking b ON b.id=a.booking_id WHERE a.operation_id=NEW.id AND (b.last_operation_id<>NEW.id OR b.status<>'confirmed' OR json_extract(NEW.result_json,'$.id') IS NOT b.id OR json_extract(NEW.result_json,'$.status') IS NOT 'confirmed'));
END;
CREATE TABLE owner_booking_attempt (
 id TEXT PRIMARY KEY CHECK(length(id)=36),actor_id TEXT NOT NULL REFERENCES user(id) ON DELETE RESTRICT,
 booking_id TEXT NOT NULL REFERENCES booking(id) ON DELETE RESTRICT,
 action TEXT NOT NULL CHECK(action IN ('accept','decline','cancel_owner')),
 reason TEXT CHECK(reason IS NULL OR length(reason) BETWEEN 1 AND 2000),
 acceptance_hash TEXT,preview_json TEXT CHECK(preview_json IS NULL OR json_valid(preview_json)),
 fingerprint TEXT NOT NULL,operation_fingerprint TEXT NOT NULL,
 created_at INTEGER NOT NULL DEFAULT(unixepoch()),
 CHECK((action='accept' AND acceptance_hash IS NOT NULL AND preview_json IS NOT NULL) OR (action<>'accept' AND acceptance_hash IS NULL AND preview_json IS NULL))
);
CREATE INDEX owner_booking_attempt_actor ON owner_booking_attempt(actor_id,booking_id,created_at,id);
CREATE TRIGGER owner_booking_attempt_context BEFORE INSERT ON owner_booking_attempt
BEGIN
 SELECT RAISE(ABORT,'invalid_actor') WHERE NOT EXISTS(SELECT 1 FROM booking b JOIN property p ON p.id=b.property_id JOIN user u ON u.id=p.owner_id WHERE b.id=NEW.booking_id AND p.owner_id=NEW.actor_id AND u.emailVerified=1);
END;
CREATE TRIGGER owner_booking_attempt_immutable_update BEFORE UPDATE ON owner_booking_attempt BEGIN SELECT RAISE(ABORT,'immutable_attempt'); END;
CREATE TRIGGER owner_booking_attempt_immutable_delete BEFORE DELETE ON owner_booking_attempt BEGIN SELECT RAISE(ABORT,'retained_attempt'); END;
