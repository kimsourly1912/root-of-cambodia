PRAGMA foreign_keys = ON;
CREATE TABLE property (id TEXT PRIMARY KEY, owner_id TEXT NOT NULL);
CREATE TABLE room_type (id TEXT PRIMARY KEY, property_id TEXT NOT NULL REFERENCES property(id));
CREATE TABLE inventory_night (
  room_type_id TEXT NOT NULL REFERENCES room_type(id),
  night TEXT NOT NULL,
  capacity INTEGER NOT NULL CHECK (capacity >= 0),
  blocked INTEGER NOT NULL DEFAULT 0 CHECK (blocked >= 0),
  reserved INTEGER NOT NULL DEFAULT 0 CHECK (reserved >= 0),
  PRIMARY KEY (room_type_id, night),
  CHECK (blocked + reserved <= capacity)
);
CREATE TABLE booking (
  id TEXT PRIMARY KEY,
  property_id TEXT NOT NULL REFERENCES property(id),
  guest_id TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK(status IN ('pending','confirmed','cancelled','declined','expired')),
  expires_at INTEGER NOT NULL,
  checkin_at INTEGER NOT NULL,
  expected_nights INTEGER NOT NULL CHECK(expected_nights > 0),
  total_cents INTEGER NOT NULL CHECK(total_cents >= 0),
  confirmed_at INTEGER,
  cancelled_at INTEGER
);
CREATE INDEX booking_due ON booking(status, expires_at);
CREATE TABLE requested_night (
  booking_id TEXT NOT NULL REFERENCES booking(id),
  room_type_id TEXT NOT NULL REFERENCES room_type(id),
  night TEXT NOT NULL,
  quantity INTEGER NOT NULL CHECK(quantity > 0),
  PRIMARY KEY(booking_id,room_type_id,night)
);
CREATE TABLE allocation (
  booking_id TEXT NOT NULL REFERENCES booking(id),
  room_type_id TEXT NOT NULL,
  night TEXT NOT NULL,
  quantity INTEGER NOT NULL CHECK(quantity > 0),
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

CREATE TRIGGER validate_confirmation AFTER UPDATE OF status ON booking
WHEN NEW.status = 'confirmed' AND OLD.status != 'confirmed'
BEGIN
  SELECT RAISE(ABORT,'invalid_transition') WHERE OLD.status != 'pending';
  SELECT RAISE(ABORT,'request_expired') WHERE NEW.expires_at <= unixepoch();
  SELECT RAISE(ABORT,'invalid_snapshot')
    WHERE (SELECT count(*) FROM requested_night WHERE booking_id=NEW.id) != NEW.expected_nights;
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
