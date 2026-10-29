-- Calendar writes use one operation for all selected dates. Existing rows are retained.
CREATE TABLE room_calendar_event (
 operation_id TEXT NOT NULL REFERENCES operation(id) ON DELETE RESTRICT,
 room_type_id TEXT NOT NULL,
 night TEXT NOT NULL,
 actor_id TEXT NOT NULL REFERENCES user(id) ON DELETE RESTRICT,
 capacity INTEGER NOT NULL CHECK(typeof(capacity)='integer' AND capacity BETWEEN 0 AND 10000),
 blocked INTEGER NOT NULL CHECK(typeof(blocked)='integer' AND blocked BETWEEN 0 AND 10000),
 reserved INTEGER NOT NULL CHECK(typeof(reserved)='integer' AND reserved>=0),
 unit_cents INTEGER NOT NULL CHECK(typeof(unit_cents)='integer' AND unit_cents BETWEEN 0 AND 100000000),
 inventory_revision INTEGER NOT NULL CHECK(typeof(inventory_revision)='integer' AND inventory_revision>0),
 rate_revision INTEGER NOT NULL CHECK(typeof(rate_revision)='integer' AND rate_revision>0),
 room_revision INTEGER NOT NULL CHECK(typeof(room_revision)='integer' AND room_revision>0),
 occurred_at INTEGER NOT NULL DEFAULT (unixepoch()),
 PRIMARY KEY(operation_id,night),
 FOREIGN KEY(room_type_id,night) REFERENCES inventory_night(room_type_id,night) ON DELETE RESTRICT,
 FOREIGN KEY(room_type_id,night) REFERENCES nightly_rate(room_type_id,night) ON DELETE RESTRICT,
 CHECK(blocked+reserved<=capacity)
);
CREATE INDEX room_calendar_history ON room_calendar_event(room_type_id,night);
CREATE TRIGGER room_calendar_event_context BEFORE INSERT ON room_calendar_event BEGIN
 SELECT CASE WHEN NOT EXISTS (
  SELECT 1 FROM room_type r JOIN property p ON p.id=r.property_id
  JOIN place l ON l.id=p.id JOIN user u ON u.id=p.owner_id
  JOIN operation o ON o.id=NEW.operation_id
  JOIN inventory_night i ON i.room_type_id=r.id AND i.night=NEW.night
  JOIN nightly_rate n ON n.room_type_id=r.id AND n.night=NEW.night
  WHERE r.id=NEW.room_type_id AND p.owner_id=NEW.actor_id AND u.emailVerified=1
   AND l.publication='draft' AND r.revision=NEW.room_revision
   AND i.capacity=NEW.capacity AND i.blocked=NEW.blocked AND i.reserved=NEW.reserved
   AND n.unit_cents=NEW.unit_cents AND i.revision=NEW.inventory_revision AND n.revision=NEW.rate_revision
   AND o.actor_id=NEW.actor_id AND o.principal='user:'||NEW.actor_id
   AND o.actor_role='owner' AND o.kind='room_calendar' AND o.result_json IS NULL
 ) THEN RAISE(ABORT,'invalid_calendar_actor') END;
END;
CREATE TRIGGER room_calendar_event_immutable_update BEFORE UPDATE ON room_calendar_event BEGIN
 SELECT RAISE(ABORT,'immutable_calendar_history');
END;
CREATE TRIGGER room_calendar_event_immutable_delete BEFORE DELETE ON room_calendar_event BEGIN
 SELECT RAISE(ABORT,'immutable_calendar_history');
END;
