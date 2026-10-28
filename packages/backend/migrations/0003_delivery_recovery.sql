-- Additive upgrade: existing bookings, allocations, receipts and delivery attempts survive.
ALTER TABLE delivery_attempt ADD COLUMN error_code TEXT CHECK(error_code IS NULL OR error_code IN ('recipient_unavailable','provider_retry'));
CREATE INDEX outbox_expired_lease ON notification_outbox(state,lease_until);
CREATE TRIGGER inventory_room_immutable BEFORE UPDATE OF room_type_id,night ON inventory_night
BEGIN
 SELECT RAISE(ABORT,'immutable_inventory_identity');
END;
CREATE TRIGGER rate_identity_immutable BEFORE UPDATE OF room_type_id,night ON nightly_rate
BEGIN
 SELECT RAISE(ABORT,'immutable_rate_identity');
END;
CREATE TRIGGER room_property_immutable BEFORE UPDATE OF property_id ON room_type
BEGIN
 SELECT RAISE(ABORT,'immutable_room_property');
END;
