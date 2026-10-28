-- Additive safeguards: never edit applied migrations or rewrite submitted history.
-- Fail closed on incompatible legacy data; investigate/repair under a reviewed plan.
-- Migration runners must apply this whole file atomically (D1 migrations / native test helper).
CREATE TABLE _migration_0004_guard (
 valid INTEGER NOT NULL CONSTRAINT migration_0004_existing_data_valid CHECK(valid=1)
);
INSERT INTO _migration_0004_guard(valid)
 SELECT CASE WHEN
 NOT EXISTS(SELECT 1 FROM owner_profile WHERE user_id IS NULL)
 AND NOT EXISTS(SELECT 1 FROM place WHERE id IS NULL)
 AND NOT EXISTS(SELECT 1 FROM property WHERE id IS NULL)
 AND NOT EXISTS(SELECT 1 FROM room_type WHERE id IS NULL)
 AND NOT EXISTS(SELECT 1 FROM operation WHERE id IS NULL)
 AND NOT EXISTS(SELECT 1 FROM operation_assert WHERE operation_id IS NULL)
 AND NOT EXISTS(SELECT 1 FROM booking WHERE id IS NULL)
 AND NOT EXISTS(SELECT 1 FROM booking_line WHERE id IS NULL)
 AND NOT EXISTS(SELECT 1 FROM booking_event WHERE id IS NULL)
 AND NOT EXISTS(SELECT 1 FROM notification_outbox WHERE id IS NULL)
 AND NOT EXISTS(SELECT 1 FROM inventory_event WHERE operation_id IS NULL)
 AND NOT EXISTS(SELECT 1 FROM booking WHERE typeof(submitted_at)!='integer' OR datetime(submitted_at,'unixepoch') IS NULL
 OR typeof(expires_at)!='integer' OR datetime(expires_at,'unixepoch') IS NULL
 OR typeof(checkin_at)!='integer' OR datetime(checkin_at,'unixepoch') IS NULL
 OR typeof(checkout_at)!='integer' OR datetime(checkout_at,'unixepoch') IS NULL
 OR length(checkin_time)!=5 OR checkin_time NOT GLOB '[0-2][0-9]:[0-5][0-9]' OR checkin_time>='24:00'
 OR length(checkout_time)!=5 OR checkout_time NOT GLOB '[0-2][0-9]:[0-5][0-9]' OR checkout_time>='24:00'
 OR unixepoch(checkin_date||'T'||checkin_time||':00+07:00') IS NULL
 OR checkin_at IS NOT unixepoch(checkin_date||'T'||checkin_time||':00+07:00')
 OR unixepoch(checkout_date||'T'||checkout_time||':00+07:00') IS NULL
 OR checkout_at IS NOT unixepoch(checkout_date||'T'||checkout_time||':00+07:00'))
 THEN 1 ELSE 0 END;
DROP TABLE _migration_0004_guard;

-- SQLite's existing TEXT PRIMARY KEY columns allow NULL without explicit NOT NULL.
-- Use insert/update guards to preserve tables, FKs, indexes and historical identities.
-- These guards enforce presence; they do not introduce a new ID format policy.
CREATE TRIGGER owner_profile_identity_insert BEFORE INSERT ON owner_profile
WHEN NEW.user_id IS NULL
BEGIN
 SELECT RAISE(ABORT,'null_business_identity');
END;
CREATE TRIGGER owner_profile_identity_update BEFORE UPDATE OF user_id ON owner_profile
WHEN NEW.user_id IS NULL
BEGIN
 SELECT RAISE(ABORT,'null_business_identity');
END;
CREATE TRIGGER place_identity_insert BEFORE INSERT ON place
WHEN NEW.id IS NULL
BEGIN
 SELECT RAISE(ABORT,'null_business_identity');
END;
CREATE TRIGGER place_identity_update BEFORE UPDATE OF id ON place
WHEN NEW.id IS NULL
BEGIN
 SELECT RAISE(ABORT,'null_business_identity');
END;
CREATE TRIGGER property_identity_insert BEFORE INSERT ON property
WHEN NEW.id IS NULL
BEGIN
 SELECT RAISE(ABORT,'null_business_identity');
END;
CREATE TRIGGER property_identity_update BEFORE UPDATE OF id ON property
WHEN NEW.id IS NULL
BEGIN
 SELECT RAISE(ABORT,'null_business_identity');
END;
CREATE TRIGGER room_type_identity_insert BEFORE INSERT ON room_type
WHEN NEW.id IS NULL
BEGIN
 SELECT RAISE(ABORT,'null_business_identity');
END;
CREATE TRIGGER room_type_identity_update BEFORE UPDATE OF id ON room_type
WHEN NEW.id IS NULL
BEGIN
 SELECT RAISE(ABORT,'null_business_identity');
END;
CREATE TRIGGER operation_identity_insert BEFORE INSERT ON operation
WHEN NEW.id IS NULL
BEGIN
 SELECT RAISE(ABORT,'null_business_identity');
END;
CREATE TRIGGER operation_identity_update BEFORE UPDATE OF id ON operation
WHEN NEW.id IS NULL
BEGIN
 SELECT RAISE(ABORT,'null_business_identity');
END;
CREATE TRIGGER operation_assert_identity_insert BEFORE INSERT ON operation_assert
WHEN NEW.operation_id IS NULL
BEGIN
 SELECT RAISE(ABORT,'null_business_identity');
END;
CREATE TRIGGER operation_assert_identity_update BEFORE UPDATE OF operation_id ON operation_assert
WHEN NEW.operation_id IS NULL
BEGIN
 SELECT RAISE(ABORT,'null_business_identity');
END;
CREATE TRIGGER booking_identity_insert BEFORE INSERT ON booking
WHEN NEW.id IS NULL
BEGIN
 SELECT RAISE(ABORT,'null_business_identity');
END;
CREATE TRIGGER booking_identity_update BEFORE UPDATE OF id ON booking
WHEN NEW.id IS NULL
BEGIN
 SELECT RAISE(ABORT,'null_business_identity');
END;
CREATE TRIGGER booking_line_identity_insert BEFORE INSERT ON booking_line
WHEN NEW.id IS NULL
BEGIN
 SELECT RAISE(ABORT,'null_business_identity');
END;
CREATE TRIGGER booking_line_identity_update BEFORE UPDATE OF id ON booking_line
WHEN NEW.id IS NULL
BEGIN
 SELECT RAISE(ABORT,'null_business_identity');
END;
CREATE TRIGGER booking_event_identity_insert BEFORE INSERT ON booking_event
WHEN NEW.id IS NULL
BEGIN
 SELECT RAISE(ABORT,'null_business_identity');
END;
CREATE TRIGGER booking_event_identity_update BEFORE UPDATE OF id ON booking_event
WHEN NEW.id IS NULL
BEGIN
 SELECT RAISE(ABORT,'null_business_identity');
END;
CREATE TRIGGER notification_outbox_identity_insert BEFORE INSERT ON notification_outbox
WHEN NEW.id IS NULL
BEGIN
 SELECT RAISE(ABORT,'null_business_identity');
END;
CREATE TRIGGER notification_outbox_identity_update BEFORE UPDATE OF id ON notification_outbox
WHEN NEW.id IS NULL
BEGIN
 SELECT RAISE(ABORT,'null_business_identity');
END;
CREATE TRIGGER inventory_event_identity_insert BEFORE INSERT ON inventory_event
WHEN NEW.operation_id IS NULL
BEGIN
 SELECT RAISE(ABORT,'null_business_identity');
END;
CREATE TRIGGER inventory_event_identity_update BEFORE UPDATE OF operation_id ON inventory_event
WHEN NEW.operation_id IS NULL
BEGIN
 SELECT RAISE(ABORT,'null_business_identity');
END;

-- Validate snapshots, never the current mutable property schedule. Cambodia uses UTC+07:00.
CREATE TRIGGER booking_schedule_insert BEFORE INSERT ON booking
WHEN typeof(NEW.submitted_at)!='integer' OR datetime(NEW.submitted_at,'unixepoch') IS NULL
 OR typeof(NEW.expires_at)!='integer' OR datetime(NEW.expires_at,'unixepoch') IS NULL
 OR typeof(NEW.checkin_at)!='integer' OR datetime(NEW.checkin_at,'unixepoch') IS NULL
 OR typeof(NEW.checkout_at)!='integer' OR datetime(NEW.checkout_at,'unixepoch') IS NULL
 OR length(NEW.checkin_time)!=5 OR NEW.checkin_time NOT GLOB '[0-2][0-9]:[0-5][0-9]' OR NEW.checkin_time>='24:00'
 OR length(NEW.checkout_time)!=5 OR NEW.checkout_time NOT GLOB '[0-2][0-9]:[0-5][0-9]' OR NEW.checkout_time>='24:00'
 OR unixepoch(NEW.checkin_date||'T'||NEW.checkin_time||':00+07:00') IS NULL
 OR NEW.checkin_at IS NOT unixepoch(NEW.checkin_date||'T'||NEW.checkin_time||':00+07:00')
 OR unixepoch(NEW.checkout_date||'T'||NEW.checkout_time||':00+07:00') IS NULL
 OR NEW.checkout_at IS NOT unixepoch(NEW.checkout_date||'T'||NEW.checkout_time||':00+07:00')
BEGIN
 SELECT RAISE(ABORT,'invalid_booking_schedule');
END;
CREATE TRIGGER booking_schedule_update BEFORE UPDATE ON booking
WHEN typeof(NEW.submitted_at)!='integer' OR datetime(NEW.submitted_at,'unixepoch') IS NULL
 OR typeof(NEW.expires_at)!='integer' OR datetime(NEW.expires_at,'unixepoch') IS NULL
 OR typeof(NEW.checkin_at)!='integer' OR datetime(NEW.checkin_at,'unixepoch') IS NULL
 OR typeof(NEW.checkout_at)!='integer' OR datetime(NEW.checkout_at,'unixepoch') IS NULL
 OR length(NEW.checkin_time)!=5 OR NEW.checkin_time NOT GLOB '[0-2][0-9]:[0-5][0-9]' OR NEW.checkin_time>='24:00'
 OR length(NEW.checkout_time)!=5 OR NEW.checkout_time NOT GLOB '[0-2][0-9]:[0-5][0-9]' OR NEW.checkout_time>='24:00'
 OR unixepoch(NEW.checkin_date||'T'||NEW.checkin_time||':00+07:00') IS NULL
 OR NEW.checkin_at IS NOT unixepoch(NEW.checkin_date||'T'||NEW.checkin_time||':00+07:00')
 OR unixepoch(NEW.checkout_date||'T'||NEW.checkout_time||':00+07:00') IS NULL
 OR NEW.checkout_at IS NOT unixepoch(NEW.checkout_date||'T'||NEW.checkout_time||':00+07:00')
BEGIN
 SELECT RAISE(ABORT,'invalid_booking_schedule');
END;

-- The existing actor/resource/verification guard still applies independently.
-- External and online submission retain kind='submit' for receipt compatibility.
-- check_in is a trusted database command only: the public service remains policy-blocked.
CREATE TRIGGER booking_operation_kind BEFORE UPDATE OF status ON booking
WHEN NEW.status!=OLD.status
BEGIN
 SELECT RAISE(ABORT,'invalid_operation_kind') WHERE NOT EXISTS(
  SELECT 1 FROM operation o WHERE o.id=NEW.last_operation_id AND (
   (OLD.status='building' AND NEW.source='online' AND NEW.status='pending' AND o.kind='submit' AND o.actor_role='guest')
   OR (OLD.status='building' AND NEW.source='external' AND NEW.status='confirmed' AND o.kind='submit' AND o.actor_role='owner')
   OR (OLD.status='pending' AND NEW.status='confirmed' AND o.kind='accept' AND o.actor_role='owner')
   OR (OLD.status='pending' AND NEW.status='declined' AND o.kind='decline' AND o.actor_role='owner')
   OR (OLD.status='pending' AND NEW.status='expired' AND o.kind='expire' AND o.actor_role='system')
   OR (OLD.status IN ('pending','confirmed') AND NEW.status='cancelled' AND (
    (o.kind='cancel_guest' AND o.actor_role='guest') OR (o.kind='cancel_owner' AND o.actor_role='owner')
   ))
   OR (OLD.status='confirmed' AND NEW.status='checked_in' AND o.kind='check_in' AND o.actor_role='owner')
   OR (OLD.status='checked_in' AND NEW.status='completed' AND o.kind='complete' AND o.actor_role='owner')
  )
 );
END;
CREATE TRIGGER booking_cancellation_cutoff BEFORE UPDATE OF status ON booking
WHEN NEW.status='cancelled' AND NEW.status!=OLD.status AND NEW.checkin_at<=unixepoch()
BEGIN
 SELECT RAISE(ABORT,'cancellation_cutoff');
END;
-- Command attribution and an already completed response are stable retry evidence.
-- A newly inserted command may receive its result once inside the same atomic batch.
CREATE TRIGGER operation_context_immutable BEFORE UPDATE ON operation
WHEN NEW.id IS NOT OLD.id OR NEW.principal IS NOT OLD.principal
 OR NEW.actor_id IS NOT OLD.actor_id OR NEW.kind IS NOT OLD.kind
 OR NEW.actor_role IS NOT OLD.actor_role OR NEW.key IS NOT OLD.key
 OR NEW.fingerprint IS NOT OLD.fingerprint OR NEW.created_at IS NOT OLD.created_at
 OR (OLD.result_json IS NOT NULL AND NEW.result_json IS NOT OLD.result_json)
BEGIN
 SELECT RAISE(ABORT,'immutable_operation_context');
END;
