-- Local guest request recovery; no old bookings, terms or receipts are backfilled.
CREATE TABLE booking_terms_document (
 version TEXT PRIMARY KEY CHECK(length(version) BETWEEN 1 AND 100 AND version!='unconfigured'),
 content TEXT NOT NULL CHECK(length(trim(content)) BETWEEN 1 AND 20000),
 created_at INTEGER NOT NULL DEFAULT(unixepoch())
);
CREATE TRIGGER booking_terms_immutable_update BEFORE UPDATE ON booking_terms_document BEGIN SELECT RAISE(ABORT,'immutable_terms'); END;
CREATE TRIGGER booking_terms_immutable_delete BEFORE DELETE ON booking_terms_document BEGIN SELECT RAISE(ABORT,'retained_terms'); END;
CREATE TABLE guest_booking_attempt (
 id TEXT PRIMARY KEY CHECK(length(id)=36),
 guest_id TEXT NOT NULL REFERENCES user(id) ON DELETE RESTRICT,
 fingerprint TEXT NOT NULL,
 input_json TEXT NOT NULL CHECK(json_valid(input_json)),
 quote_hash TEXT NOT NULL CHECK(length(quote_hash)=64),
 preview_json TEXT NOT NULL CHECK(json_valid(preview_json)),
 terms_version TEXT NOT NULL REFERENCES booking_terms_document(version) ON DELETE RESTRICT,
 created_at INTEGER NOT NULL DEFAULT(unixepoch())
);
CREATE INDEX guest_booking_attempt_guest ON guest_booking_attempt(guest_id,created_at,id);
CREATE TRIGGER guest_booking_attempt_verified BEFORE INSERT ON guest_booking_attempt
BEGIN
 SELECT RAISE(ABORT,'verified_session_required') WHERE NOT EXISTS(SELECT 1 FROM user WHERE id=NEW.guest_id AND emailVerified=1);
 SELECT RAISE(ABORT,'invalid_attempt') WHERE json_extract(NEW.input_json,'$.termsVersion') IS NOT NEW.terms_version;
END;
CREATE TRIGGER guest_booking_attempt_immutable_update BEFORE UPDATE ON guest_booking_attempt BEGIN SELECT RAISE(ABORT,'immutable_attempt'); END;
CREATE TRIGGER guest_booking_attempt_immutable_delete BEFORE DELETE ON guest_booking_attempt BEGIN SELECT RAISE(ABORT,'retained_attempt'); END;
-- Fence the new UI submission path inside the existing atomic booking write.
-- Earlier APIs/receipts retain their contract; these keys belong to saved UI attempts.
CREATE TRIGGER guest_booking_attempt_submission BEFORE UPDATE OF status ON booking
WHEN OLD.status='building' AND NEW.status='pending' AND EXISTS(SELECT 1 FROM operation WHERE id=NEW.last_operation_id AND substr(key,1,14)='guest-request:')
BEGIN
 SELECT RAISE(ABORT,'invalid_attempt') WHERE NOT EXISTS(
  SELECT 1 FROM operation o JOIN guest_booking_attempt a ON o.key='guest-request:'||a.id AND o.principal='user:'||a.guest_id
  JOIN booking_terms_document t ON t.version=a.terms_version JOIN pilot_publication_config c ON c.singleton=1 AND c.terms_version=t.version
  JOIN property_review_request r ON r.property_id=NEW.property_id AND r.status='approved' AND r.owner_id=(SELECT owner_id FROM property WHERE id=NEW.property_id)
  JOIN public_listing_disclosure d ON d.request_id=r.id AND d.owner_id=r.owner_id AND d.policy_version='public-listing-v1'
  WHERE o.id=NEW.last_operation_id AND a.guest_id=NEW.guest_id AND a.terms_version=NEW.terms_version
   AND json_extract(a.input_json,'$.propertyId')=NEW.property_id AND r.approved_terms_version=NEW.terms_version
   AND r.sequence=(SELECT max(sequence) FROM property_review_request WHERE property_id=NEW.property_id)
 );
END;
