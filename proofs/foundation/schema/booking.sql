PRAGMA foreign_keys = ON;
CREATE TABLE property (id TEXT PRIMARY KEY, owner_id TEXT NOT NULL);
CREATE TABLE room_type (id TEXT PRIMARY KEY, property_id TEXT NOT NULL REFERENCES property(id));
CREATE TABLE inventory_night (
  room_type_id TEXT NOT NULL REFERENCES room_type(id),
  night TEXT NOT NULL CHECK(length(night)=10 AND date(night,'+0 days') IS NOT NULL AND date(night,'+0 days')=night),
  capacity INTEGER NOT NULL CHECK (typeof(capacity)='integer' AND capacity >= 0),
  blocked INTEGER NOT NULL DEFAULT 0 CHECK (typeof(blocked)='integer' AND blocked >= 0),
  reserved INTEGER NOT NULL DEFAULT 0 CHECK (typeof(reserved)='integer' AND reserved >= 0),
  PRIMARY KEY (room_type_id, night),
  CHECK (blocked + reserved <= capacity)
);
CREATE TABLE booking (
  id TEXT PRIMARY KEY,
  property_id TEXT NOT NULL REFERENCES property(id),
  guest_id TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK(status IN ('pending','confirmed','cancelled','declined','expired')),
  expires_at INTEGER NOT NULL CHECK(typeof(expires_at)='integer'),
  checkin_at INTEGER NOT NULL CHECK(typeof(checkin_at)='integer' AND date(checkin_at,'unixepoch') IS NOT NULL),
  checkin_date TEXT NOT NULL CHECK(length(checkin_date)=10 AND date(checkin_date,'+0 days') IS NOT NULL AND date(checkin_date,'+0 days')=checkin_date AND date(checkin_at,'unixepoch','+7 hours')=checkin_date),
  checkout_date TEXT NOT NULL CHECK(length(checkout_date)=10 AND date(checkout_date,'+0 days') IS NOT NULL AND date(checkout_date,'+0 days')=checkout_date AND checkout_date>checkin_date),
  expected_nights INTEGER NOT NULL CHECK(typeof(expected_nights)='integer' AND expected_nights > 0),
  total_cents INTEGER NOT NULL CHECK(typeof(total_cents)='integer' AND total_cents >= 0),
  currency TEXT NOT NULL DEFAULT 'USD' CHECK(currency='USD'),
  fees_cents INTEGER NOT NULL DEFAULT 0 CHECK(typeof(fees_cents)='integer' AND fees_cents>=0),
  snapshot_sealed INTEGER NOT NULL DEFAULT 0 CHECK(snapshot_sealed IN (0,1)),
  confirmed_at INTEGER,
  cancelled_at INTEGER,
  cancelled_by TEXT,
  cancellation_role TEXT CHECK(cancellation_role IN ('guest','owner')),
  cancellation_reason TEXT
);
CREATE INDEX booking_due ON booking(status, expires_at);
CREATE TABLE requested_night (
  booking_id TEXT NOT NULL REFERENCES booking(id),
  room_type_id TEXT NOT NULL REFERENCES room_type(id),
  night TEXT NOT NULL CHECK(length(night)=10 AND date(night,'+0 days') IS NOT NULL AND date(night,'+0 days')=night),
  quantity INTEGER NOT NULL CHECK(typeof(quantity)='integer' AND quantity > 0),
  unit_price_cents INTEGER NOT NULL CHECK(typeof(unit_price_cents)='integer' AND unit_price_cents>=0),
  PRIMARY KEY(booking_id,room_type_id,night)
);
CREATE TABLE allocation (
  booking_id TEXT NOT NULL REFERENCES booking(id),
  room_type_id TEXT NOT NULL,
  night TEXT NOT NULL,
  quantity INTEGER NOT NULL CHECK(typeof(quantity)='integer' AND quantity > 0),
  released INTEGER NOT NULL DEFAULT 0 CHECK(released IN (0,1)),
  PRIMARY KEY(booking_id,room_type_id,night),
  FOREIGN KEY(room_type_id,night) REFERENCES inventory_night(room_type_id,night)
);
CREATE TABLE booking_event (
  booking_id TEXT NOT NULL REFERENCES booking(id),
  kind TEXT NOT NULL,
  PRIMARY KEY(booking_id,kind)
);
CREATE TABLE notification_outbox (
  id TEXT PRIMARY KEY,
  booking_id TEXT NOT NULL REFERENCES booking(id),
  kind TEXT NOT NULL,
  delivered INTEGER NOT NULL DEFAULT 0,
  UNIQUE(booking_id,kind)
);
CREATE TABLE batch_probe (id TEXT PRIMARY KEY);

CREATE TRIGGER initial_booking_state BEFORE INSERT ON booking
BEGIN
  SELECT RAISE(ABORT,'invalid_initial_state') WHERE NEW.status!='pending' OR NEW.snapshot_sealed!=0;
END;

CREATE TRIGGER booking_transition BEFORE UPDATE OF status ON booking
WHEN NEW.status!=OLD.status
BEGIN
  SELECT RAISE(ABORT,'invalid_transition') WHERE NOT (
    (OLD.status='pending' AND NEW.status IN ('confirmed','cancelled','declined','expired'))
    OR (OLD.status='confirmed' AND NEW.status='cancelled')
  );
END;

CREATE TRIGGER immutable_booking_quote BEFORE UPDATE ON booking
BEGIN
  SELECT RAISE(ABORT,'immutable_snapshot') WHERE
    NEW.id IS NOT OLD.id OR NEW.property_id IS NOT OLD.property_id OR NEW.guest_id IS NOT OLD.guest_id
    OR NEW.expires_at IS NOT OLD.expires_at OR NEW.checkin_at IS NOT OLD.checkin_at
    OR NEW.checkin_date IS NOT OLD.checkin_date OR NEW.checkout_date IS NOT OLD.checkout_date
    OR NEW.expected_nights IS NOT OLD.expected_nights OR NEW.total_cents IS NOT OLD.total_cents
    OR NEW.currency IS NOT OLD.currency OR NEW.fees_cents IS NOT OLD.fees_cents
    OR (OLD.snapshot_sealed=1 AND NEW.snapshot_sealed!=1);
  SELECT RAISE(ABORT,'immutable_cancellation') WHERE OLD.status='cancelled' AND (
    NEW.cancelled_at IS NOT OLD.cancelled_at OR NEW.cancelled_by IS NOT OLD.cancelled_by
    OR NEW.cancellation_role IS NOT OLD.cancellation_role OR NEW.cancellation_reason IS NOT OLD.cancellation_reason
  );
END;

CREATE TRIGGER immutable_requested_update BEFORE UPDATE ON requested_night
BEGIN
  SELECT RAISE(ABORT,'immutable_snapshot');
END;

CREATE TRIGGER immutable_requested_delete BEFORE DELETE ON requested_night
BEGIN
  SELECT RAISE(ABORT,'immutable_snapshot');
END;

CREATE TRIGGER sealed_requested_insert BEFORE INSERT ON requested_night
BEGIN
  SELECT RAISE(ABORT,'immutable_snapshot') WHERE EXISTS (
    SELECT 1 FROM booking WHERE id=NEW.booking_id AND (snapshot_sealed=1 OR status!='pending')
  );
END;

CREATE TRIGGER validate_confirmation AFTER UPDATE OF status ON booking
WHEN NEW.status = 'confirmed' AND OLD.status != 'confirmed'
BEGIN
  SELECT RAISE(ABORT,'invalid_transition') WHERE OLD.status != 'pending';
  SELECT RAISE(ABORT,'request_expired') WHERE NEW.expires_at <= unixepoch();
  SELECT RAISE(ABORT,'invalid_snapshot') WHERE NEW.snapshot_sealed!=1
    OR (SELECT count(*) FROM requested_night WHERE booking_id=NEW.id) != NEW.expected_nights;
  SELECT RAISE(ABORT,'invalid_dates') WHERE EXISTS (
    SELECT 1 FROM requested_night WHERE booking_id=NEW.id
    GROUP BY room_type_id HAVING min(night)<NEW.checkin_date OR max(night)>=NEW.checkout_date
      OR count(*)!=julianday(NEW.checkout_date)-julianday(NEW.checkin_date)
      OR min(quantity)!=max(quantity)
  );
  SELECT RAISE(ABORT,'invalid_total') WHERE NEW.total_cents!=NEW.fees_cents + (
    SELECT sum(quantity*unit_price_cents) FROM requested_night WHERE booking_id=NEW.id
  );
  SELECT RAISE(ABORT,'wrong_property')
    WHERE EXISTS (
      SELECT 1 FROM requested_night n JOIN room_type r ON r.id=n.room_type_id
      WHERE n.booking_id=NEW.id AND r.property_id != NEW.property_id
    );
  SELECT RAISE(ABORT,'missing_inventory')
    WHERE EXISTS (
      SELECT 1 FROM requested_night n LEFT JOIN inventory_night i
        ON i.room_type_id=n.room_type_id AND i.night=n.night
      WHERE n.booking_id=NEW.id AND i.room_type_id IS NULL
    );
  UPDATE inventory_night
  SET reserved=reserved + (
    SELECT n.quantity FROM requested_night n
    WHERE n.booking_id=NEW.id AND n.room_type_id=inventory_night.room_type_id AND n.night=inventory_night.night
  )
  WHERE EXISTS (
    SELECT 1 FROM requested_night n
    WHERE n.booking_id=NEW.id AND n.room_type_id=inventory_night.room_type_id AND n.night=inventory_night.night
  );
  INSERT INTO allocation(booking_id,room_type_id,night,quantity)
    SELECT booking_id,room_type_id,night,quantity FROM requested_night WHERE booking_id=NEW.id;
  INSERT INTO booking_event(booking_id,kind) VALUES(NEW.id,'confirmed');
  INSERT INTO notification_outbox(id,booking_id,kind) VALUES(NEW.id || ':confirmed',NEW.id,'confirmed');
END;

CREATE TRIGGER apply_cancellation AFTER UPDATE OF status ON booking
WHEN NEW.status = 'cancelled' AND OLD.status != 'cancelled'
BEGIN
  SELECT RAISE(ABORT,'invalid_transition') WHERE OLD.status NOT IN ('pending','confirmed');
  SELECT RAISE(ABORT,'invalid_cancellation') WHERE NEW.cancelled_by IS NULL
    OR NEW.cancellation_role IS NULL OR NEW.cancelled_at IS NULL;
  SELECT RAISE(ABORT,'owner_reason_required') WHERE NEW.cancellation_role='owner'
    AND (NEW.cancellation_reason IS NULL OR length(trim(NEW.cancellation_reason))=0);
  UPDATE inventory_night
  SET reserved=reserved - (
    SELECT a.quantity FROM allocation a
    WHERE a.booking_id=NEW.id AND a.released=0 AND a.room_type_id=inventory_night.room_type_id AND a.night=inventory_night.night
  )
  WHERE EXISTS (
    SELECT 1 FROM allocation a
    WHERE a.booking_id=NEW.id AND a.released=0 AND a.room_type_id=inventory_night.room_type_id AND a.night=inventory_night.night
  );
  UPDATE allocation SET released=1 WHERE booking_id=NEW.id AND released=0;
  INSERT INTO booking_event(booking_id,kind) VALUES(NEW.id,'cancelled');
  INSERT INTO notification_outbox(id,booking_id,kind) VALUES(NEW.id || ':cancelled',NEW.id,'cancelled');
END;
