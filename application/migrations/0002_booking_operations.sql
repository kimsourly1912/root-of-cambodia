-- New application migrations, NOT an upgrade of proofs/foundation/schema/booking.sql.
CREATE TABLE operation (
 id TEXT PRIMARY KEY, principal TEXT NOT NULL, actor_id TEXT REFERENCES user(id) ON DELETE RESTRICT,
 kind TEXT NOT NULL, actor_role TEXT NOT NULL CHECK(actor_role IN ('guest','owner','system')),
 key TEXT NOT NULL CHECK(length(key) BETWEEN 1 AND 128), fingerprint TEXT NOT NULL,
 result_json TEXT CHECK(result_json IS NULL OR json_valid(result_json)), created_at INTEGER NOT NULL DEFAULT(unixepoch()),
 UNIQUE(principal,key)
);
-- A failing assertion aborts its entire D1 batch, including the operation receipt.
CREATE TABLE operation_assert (operation_id TEXT PRIMARY KEY REFERENCES operation(id) ON DELETE RESTRICT, ok INTEGER NOT NULL CHECK(ok=1));
CREATE TABLE booking (
 id TEXT PRIMARY KEY, property_id TEXT NOT NULL REFERENCES property(id) ON DELETE RESTRICT,
 guest_id TEXT REFERENCES user(id) ON DELETE RESTRICT,
 source TEXT NOT NULL CHECK(source IN ('online','external')),
 status TEXT NOT NULL DEFAULT 'building' CHECK(status IN ('building','pending','confirmed','declined','expired','cancelled','checked_in','completed')),
 submitted_at INTEGER NOT NULL CHECK(typeof(submitted_at)='integer'),
 expires_at INTEGER NOT NULL CHECK(typeof(expires_at)='integer' AND expires_at=submitted_at+43200),
 checkin_date TEXT NOT NULL CHECK(length(checkin_date)=10 AND date(checkin_date,'+0 days') IS NOT NULL AND date(checkin_date,'+0 days')=checkin_date),
 checkout_date TEXT NOT NULL CHECK(length(checkout_date)=10 AND date(checkout_date,'+0 days') IS NOT NULL AND date(checkout_date,'+0 days')=checkout_date AND checkout_date>checkin_date),
 checkin_at INTEGER NOT NULL CHECK(typeof(checkin_at)='integer' AND date(checkin_at,'unixepoch','+7 hours')=checkin_date),
 checkout_at INTEGER NOT NULL CHECK(typeof(checkout_at)='integer' AND date(checkout_at,'unixepoch','+7 hours')=checkout_date AND checkout_at>checkin_at),
 property_name TEXT NOT NULL, guest_name TEXT NOT NULL, guest_email TEXT,
 timezone TEXT NOT NULL CHECK(timezone='Asia/Phnom_Penh'),
 checkin_time TEXT NOT NULL, checkout_time TEXT NOT NULL,
 policy_version TEXT NOT NULL, policy_text TEXT NOT NULL, terms_version TEXT NOT NULL,
 cancellation_text TEXT NOT NULL,
 currency TEXT NOT NULL DEFAULT 'USD' CHECK(currency='USD'),
 total_cents INTEGER NOT NULL CHECK(typeof(total_cents)='integer' AND total_cents BETWEEN 0 AND 1000000000),
 last_operation_id TEXT NOT NULL REFERENCES operation(id) ON DELETE RESTRICT,
 reason TEXT CHECK(reason IS NULL OR length(reason) BETWEEN 1 AND 2000),
 UNIQUE(id,property_id), CHECK(source='external' OR guest_id IS NOT NULL)
);
CREATE INDEX booking_guest ON booking(guest_id,submitted_at,id);
CREATE INDEX booking_property ON booking(property_id,status,checkin_date,id);
CREATE INDEX booking_expiry ON booking(status,expires_at,id);
CREATE TABLE booking_line (
 id TEXT PRIMARY KEY, booking_id TEXT NOT NULL, property_id TEXT NOT NULL,
 room_type_id TEXT NOT NULL, room_name TEXT NOT NULL,
 quantity INTEGER NOT NULL CHECK(typeof(quantity)='integer' AND quantity BETWEEN 1 AND 100),
 adults INTEGER NOT NULL CHECK(typeof(adults)='integer' AND adults BETWEEN 1 AND 10000),
 children INTEGER NOT NULL CHECK(typeof(children)='integer' AND children BETWEEN 0 AND 10000),
 adult_capacity INTEGER NOT NULL, child_capacity INTEGER NOT NULL, total_capacity INTEGER NOT NULL,
 FOREIGN KEY(booking_id,property_id) REFERENCES booking(id,property_id) ON DELETE RESTRICT,
 FOREIGN KEY(room_type_id,property_id) REFERENCES room_type(id,property_id) ON DELETE RESTRICT,
 UNIQUE(booking_id,room_type_id), UNIQUE(id,booking_id,room_type_id),
 CHECK(adults<=quantity*adult_capacity AND children<=quantity*child_capacity AND adults+children<=quantity*total_capacity)
);
CREATE INDEX booking_line_booking ON booking_line(booking_id);
CREATE TABLE booking_night (
 line_id TEXT NOT NULL REFERENCES booking_line(id) ON DELETE RESTRICT,
 night TEXT NOT NULL CHECK(length(night)=10 AND date(night,'+0 days') IS NOT NULL AND date(night,'+0 days')=night),
 unit_cents INTEGER NOT NULL CHECK(typeof(unit_cents)='integer' AND unit_cents BETWEEN 0 AND 100000000),
 PRIMARY KEY(line_id,night)
);
CREATE TABLE booking_charge (
 booking_id TEXT NOT NULL REFERENCES booking(id) ON DELETE RESTRICT,
 code TEXT NOT NULL, label TEXT NOT NULL,
 amount_cents INTEGER NOT NULL CHECK(typeof(amount_cents)='integer' AND amount_cents BETWEEN 0 AND 100000000),
 PRIMARY KEY(booking_id,code)
);
CREATE TABLE allocation (
 line_id TEXT NOT NULL, booking_id TEXT NOT NULL, room_type_id TEXT NOT NULL, night TEXT NOT NULL,
 quantity INTEGER NOT NULL CHECK(typeof(quantity)='integer' AND quantity BETWEEN 1 AND 100),
 released INTEGER NOT NULL DEFAULT 0 CHECK(released IN(0,1)),
 PRIMARY KEY(line_id,night),
 FOREIGN KEY(line_id,booking_id,room_type_id) REFERENCES booking_line(id,booking_id,room_type_id) ON DELETE RESTRICT,
 FOREIGN KEY(room_type_id,night) REFERENCES inventory_night(room_type_id,night) ON DELETE RESTRICT
);
CREATE INDEX allocation_booking ON allocation(booking_id,released);
CREATE TABLE booking_event (
 id TEXT PRIMARY KEY, booking_id TEXT NOT NULL REFERENCES booking(id) ON DELETE RESTRICT,
 operation_id TEXT NOT NULL REFERENCES operation(id) ON DELETE RESTRICT,
 actor_id TEXT REFERENCES user(id) ON DELETE RESTRICT,
 kind TEXT NOT NULL, actor_role TEXT NOT NULL CHECK(actor_role IN ('guest','owner','system')), occurred_at INTEGER NOT NULL DEFAULT(unixepoch()), reason TEXT,
 UNIQUE(booking_id,kind)
);
CREATE INDEX event_booking ON booking_event(booking_id,occurred_at);
CREATE TABLE notification_outbox (
 id TEXT PRIMARY KEY, event_id TEXT NOT NULL REFERENCES booking_event(id) ON DELETE RESTRICT,
 recipient_id TEXT NOT NULL REFERENCES user(id) ON DELETE RESTRICT,
 channel TEXT NOT NULL DEFAULT 'email' CHECK(channel='email'),
 state TEXT NOT NULL DEFAULT 'pending' CHECK(state IN ('pending','sending','delivered')),
 due_at INTEGER NOT NULL DEFAULT(unixepoch()), lease_token TEXT, lease_until INTEGER,
 attempts INTEGER NOT NULL DEFAULT 0, delivered_at INTEGER, provider_id TEXT,
 UNIQUE(event_id,recipient_id,channel)
);
CREATE INDEX outbox_due ON notification_outbox(state,due_at,lease_until);
CREATE TABLE delivery_attempt (
 outbox_id TEXT NOT NULL REFERENCES notification_outbox(id) ON DELETE RESTRICT,
 attempt INTEGER NOT NULL, token TEXT NOT NULL UNIQUE,
 started_at INTEGER NOT NULL DEFAULT(unixepoch()), finished_at INTEGER,
 outcome TEXT NOT NULL CHECK(outcome IN ('started','delivered','retry')), provider_id TEXT,
 PRIMARY KEY(outbox_id,attempt)
);
CREATE TABLE inventory_event (
 operation_id TEXT PRIMARY KEY REFERENCES operation(id) ON DELETE RESTRICT,
 room_type_id TEXT NOT NULL, night TEXT NOT NULL,
 capacity INTEGER NOT NULL, blocked INTEGER NOT NULL, actor_id TEXT NOT NULL REFERENCES user(id) ON DELETE RESTRICT,
 occurred_at INTEGER NOT NULL DEFAULT(unixepoch()),
 FOREIGN KEY(room_type_id,night) REFERENCES inventory_night(room_type_id,night) ON DELETE RESTRICT
);
CREATE TRIGGER booking_initial BEFORE INSERT ON booking
BEGIN
 SELECT RAISE(ABORT,'invalid_initial_state') WHERE NEW.status!='building';
END;
CREATE TRIGGER booking_transition BEFORE UPDATE OF status ON booking WHEN NEW.status!=OLD.status
BEGIN
 SELECT RAISE(ABORT,'invalid_transition') WHERE NOT (
  (OLD.status='building' AND ((NEW.source='online' AND NEW.status='pending') OR (NEW.source='external' AND NEW.status='confirmed')))
  OR (OLD.status='pending' AND NEW.status IN ('confirmed','declined','expired','cancelled'))
  OR (OLD.status='confirmed' AND NEW.status IN ('cancelled','checked_in'))
  OR (OLD.status='checked_in' AND NEW.status='completed')
 );
 SELECT RAISE(ABORT,'operation_required') WHERE NEW.last_operation_id=OLD.last_operation_id AND OLD.status!='building';
 SELECT RAISE(ABORT,'request_expired') WHERE OLD.status='pending' AND NEW.status IN ('confirmed','declined') AND NEW.expires_at<=unixepoch();
 SELECT RAISE(ABORT,'not_due') WHERE NEW.status='expired' AND NEW.expires_at>unixepoch();
END;
CREATE TRIGGER validate_submission AFTER UPDATE OF status ON booking WHEN OLD.status='building'
BEGIN
 SELECT RAISE(ABORT,'lead_time') WHERE NEW.source='online' AND NEW.checkin_at<unixepoch()+86400;
 SELECT RAISE(ABORT,'empty_lines') WHERE NOT EXISTS(SELECT 1 FROM booking_line WHERE booking_id=NEW.id);
 SELECT RAISE(ABORT,'incomplete_nights') WHERE EXISTS(
  SELECT 1 FROM booking_line l LEFT JOIN booking_night n ON n.line_id=l.id WHERE l.booking_id=NEW.id
  GROUP BY l.id HAVING count(n.night)!=julianday(NEW.checkout_date)-julianday(NEW.checkin_date)
   OR min(n.night)!=NEW.checkin_date OR max(n.night)!=date(NEW.checkout_date,'-1 day')
 );
 SELECT RAISE(ABORT,'invalid_total') WHERE NEW.total_cents!=(
  SELECT coalesce(sum(n.unit_cents*l.quantity),0) FROM booking_line l JOIN booking_night n ON n.line_id=l.id WHERE l.booking_id=NEW.id
 )+(SELECT coalesce(sum(amount_cents),0) FROM booking_charge WHERE booking_id=NEW.id);
END;
CREATE TRIGGER allocate_booking AFTER UPDATE OF status ON booking WHEN NEW.status='confirmed' AND OLD.status!='confirmed'
BEGIN
 SELECT RAISE(ABORT,'missing_inventory') WHERE EXISTS(
  SELECT 1 FROM booking_line l JOIN booking_night n ON n.line_id=l.id LEFT JOIN inventory_night i ON i.room_type_id=l.room_type_id AND i.night=n.night
  WHERE l.booking_id=NEW.id AND i.room_type_id IS NULL
 );
 UPDATE inventory_night SET reserved=reserved+(
  SELECT l.quantity FROM booking_line l JOIN booking_night n ON n.line_id=l.id WHERE l.booking_id=NEW.id AND l.room_type_id=inventory_night.room_type_id AND n.night=inventory_night.night
 ) WHERE EXISTS(SELECT 1 FROM booking_line l JOIN booking_night n ON n.line_id=l.id WHERE l.booking_id=NEW.id AND l.room_type_id=inventory_night.room_type_id AND n.night=inventory_night.night);
 INSERT INTO allocation(line_id,booking_id,room_type_id,night,quantity)
  SELECT l.id,l.booking_id,l.room_type_id,n.night,l.quantity FROM booking_line l JOIN booking_night n ON n.line_id=l.id WHERE l.booking_id=NEW.id;
END;
CREATE TRIGGER release_booking AFTER UPDATE OF status ON booking WHEN NEW.status='cancelled' AND OLD.status!='cancelled'
BEGIN
 UPDATE inventory_night SET reserved=reserved-(
  SELECT a.quantity FROM allocation a WHERE a.booking_id=NEW.id AND a.released=0 AND a.room_type_id=inventory_night.room_type_id AND a.night=inventory_night.night
 ) WHERE EXISTS(SELECT 1 FROM allocation a WHERE a.booking_id=NEW.id AND a.released=0 AND a.room_type_id=inventory_night.room_type_id AND a.night=inventory_night.night);
 UPDATE allocation SET released=1 WHERE booking_id=NEW.id AND released=0;
END;
CREATE TRIGGER record_booking AFTER UPDATE OF status ON booking WHEN NEW.status!=OLD.status
BEGIN
 INSERT INTO booking_event(id,booking_id,operation_id,actor_id,kind,actor_role,reason)
  SELECT NEW.last_operation_id||':'||NEW.status,NEW.id,o.id,o.actor_id,NEW.status,o.actor_role,NEW.reason FROM operation o WHERE o.id=NEW.last_operation_id;
 INSERT INTO notification_outbox(id,event_id,recipient_id)
  SELECT NEW.last_operation_id||':'||NEW.status||':'||u.id,NEW.last_operation_id||':'||NEW.status,u.id
  FROM user u JOIN property p ON p.id=NEW.property_id WHERE u.id=NEW.guest_id OR u.id=p.owner_id;
END;

CREATE TRIGGER immutable_booking BEFORE UPDATE ON booking
BEGIN
 SELECT RAISE(ABORT,'immutable_snapshot') WHERE NEW.id IS NOT OLD.id OR NEW.property_id IS NOT OLD.property_id OR NEW.guest_id IS NOT OLD.guest_id OR NEW.source IS NOT OLD.source OR NEW.submitted_at IS NOT OLD.submitted_at OR NEW.expires_at IS NOT OLD.expires_at OR NEW.checkin_date IS NOT OLD.checkin_date OR NEW.checkout_date IS NOT OLD.checkout_date OR NEW.checkin_at IS NOT OLD.checkin_at OR NEW.checkout_at IS NOT OLD.checkout_at OR NEW.property_name IS NOT OLD.property_name OR NEW.guest_name IS NOT OLD.guest_name OR NEW.guest_email IS NOT OLD.guest_email OR NEW.timezone IS NOT OLD.timezone OR NEW.checkin_time IS NOT OLD.checkin_time OR NEW.checkout_time IS NOT OLD.checkout_time OR NEW.policy_version IS NOT OLD.policy_version OR NEW.policy_text IS NOT OLD.policy_text OR NEW.terms_version IS NOT OLD.terms_version OR NEW.cancellation_text IS NOT OLD.cancellation_text OR NEW.currency IS NOT OLD.currency OR NEW.total_cents IS NOT OLD.total_cents;
END;
CREATE TRIGGER retain_booking BEFORE DELETE ON booking
BEGIN
 SELECT RAISE(ABORT,'retained_history');
END;
CREATE TRIGGER immutable_booking_line_update BEFORE UPDATE ON booking_line
BEGIN
 SELECT RAISE(ABORT,'immutable_snapshot');
END;
CREATE TRIGGER immutable_booking_line_delete BEFORE DELETE ON booking_line
BEGIN
 SELECT RAISE(ABORT,'immutable_snapshot');
END;
CREATE TRIGGER sealed_booking_line BEFORE INSERT ON booking_line
BEGIN
 SELECT RAISE(ABORT,'immutable_snapshot') WHERE (SELECT status FROM booking WHERE id=NEW.booking_id)!='building';
END;
CREATE TRIGGER immutable_booking_night_update BEFORE UPDATE ON booking_night
BEGIN
 SELECT RAISE(ABORT,'immutable_snapshot');
END;
CREATE TRIGGER immutable_booking_night_delete BEFORE DELETE ON booking_night
BEGIN
 SELECT RAISE(ABORT,'immutable_snapshot');
END;
CREATE TRIGGER sealed_booking_night BEFORE INSERT ON booking_night
BEGIN
 SELECT RAISE(ABORT,'immutable_snapshot') WHERE (SELECT b.status FROM booking b JOIN booking_line l ON l.booking_id=b.id WHERE l.id=NEW.line_id)!='building';
END;
CREATE TRIGGER immutable_booking_charge_update BEFORE UPDATE ON booking_charge
BEGIN
 SELECT RAISE(ABORT,'immutable_snapshot');
END;
CREATE TRIGGER immutable_booking_charge_delete BEFORE DELETE ON booking_charge
BEGIN
 SELECT RAISE(ABORT,'immutable_snapshot');
END;
CREATE TRIGGER sealed_booking_charge BEFORE INSERT ON booking_charge
BEGIN
 SELECT RAISE(ABORT,'immutable_snapshot') WHERE (SELECT status FROM booking WHERE id=NEW.booking_id)!='building';
END;
CREATE TRIGGER retain_booking_event_update BEFORE UPDATE ON booking_event
BEGIN
 SELECT RAISE(ABORT,'retained_history');
END;
CREATE TRIGGER retain_booking_event_delete BEFORE DELETE ON booking_event
BEGIN
 SELECT RAISE(ABORT,'retained_history');
END;
CREATE TRIGGER retain_inventory_event_update BEFORE UPDATE ON inventory_event
BEGIN
 SELECT RAISE(ABORT,'retained_history');
END;
CREATE TRIGGER retain_inventory_event_delete BEFORE DELETE ON inventory_event
BEGIN
 SELECT RAISE(ABORT,'retained_history');
END;
CREATE TRIGGER revision_property AFTER UPDATE OF owner_id,checkin_time,checkout_time,policy_version,policy_text,terms_version,charges_json ON property
BEGIN
 UPDATE property SET revision=OLD.revision+1 WHERE id=NEW.id;
END;
CREATE TRIGGER revision_room_type AFTER UPDATE OF name,active,adult_capacity,child_capacity,total_capacity ON room_type
BEGIN
 UPDATE room_type SET revision=OLD.revision+1 WHERE id=NEW.id;
END;
CREATE TRIGGER revision_nightly_rate AFTER UPDATE OF unit_cents ON nightly_rate
BEGIN
 UPDATE nightly_rate SET revision=OLD.revision+1 WHERE room_type_id=NEW.room_type_id AND night=NEW.night;
END;
CREATE TRIGGER revision_inventory_night AFTER UPDATE OF capacity,blocked ON inventory_night
BEGIN
 UPDATE inventory_night SET revision=OLD.revision+1 WHERE room_type_id=NEW.room_type_id AND night=NEW.night;
END;
CREATE TRIGGER validate_transition_actor BEFORE UPDATE OF status ON booking WHEN NEW.status!=OLD.status
BEGIN
 SELECT RAISE(ABORT,'invalid_actor') WHERE NOT EXISTS(
  SELECT 1 FROM operation o LEFT JOIN user u ON u.id=o.actor_id JOIN property p ON p.id=NEW.property_id
  WHERE o.id=NEW.last_operation_id AND (
   (NEW.status='expired' AND o.actor_id IS NULL AND o.actor_role='system')
   OR (u.emailVerified=1 AND (
    (NEW.status='pending' AND o.actor_role='guest' AND o.actor_id=NEW.guest_id)
    OR (NEW.status IN ('confirmed','declined','checked_in','completed') AND o.actor_role='owner' AND o.actor_id=p.owner_id)
    OR (NEW.status='cancelled' AND ((o.actor_role='guest' AND o.actor_id=NEW.guest_id) OR (o.actor_role='owner' AND o.actor_id=p.owner_id AND NEW.reason IS NOT NULL AND length(trim(NEW.reason))>0)))
   ))
  )
 );
END;
CREATE TRIGGER terminal_context_immutable BEFORE UPDATE ON booking WHEN NEW.status=OLD.status AND (NEW.last_operation_id IS NOT OLD.last_operation_id OR NEW.reason IS NOT OLD.reason)
BEGIN
 SELECT RAISE(ABORT,'immutable_transition_context');
END;
