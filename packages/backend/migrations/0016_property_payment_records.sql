-- Owner-attested full payments only. No money movement, balances, refunds or backfill.
CREATE TABLE booking_payment_event (
 id TEXT NOT NULL PRIMARY KEY REFERENCES operation(id) ON DELETE RESTRICT,
 booking_id TEXT NOT NULL REFERENCES booking(id) ON DELETE RESTRICT,
 actor_id TEXT NOT NULL REFERENCES user(id) ON DELETE RESTRICT,
 kind TEXT NOT NULL CHECK(kind IN ('record','void')),
 amount_cents INTEGER NOT NULL CHECK(typeof(amount_cents)='integer' AND amount_cents BETWEEN 1 AND 1000000000),
 revision INTEGER NOT NULL CHECK(typeof(revision)='integer' AND revision>0),
 voids_event_id TEXT,
 reason TEXT CHECK(reason IS NULL OR length(reason) BETWEEN 1 AND 2000),
 occurred_at INTEGER NOT NULL DEFAULT(unixepoch()),
 UNIQUE(booking_id,revision),UNIQUE(id,booking_id),
 FOREIGN KEY(voids_event_id,booking_id) REFERENCES booking_payment_event(id,booking_id) ON DELETE RESTRICT,
 CHECK((kind='record' AND voids_event_id IS NULL AND reason IS NULL) OR (kind='void' AND voids_event_id IS NOT NULL AND reason IS NOT NULL AND length(trim(reason,char(9,10,11,12,13,32,160,5760,8192,8193,8194,8195,8196,8197,8198,8199,8200,8201,8202,8232,8233,8239,8287,12288,65279)))>0))
);
CREATE TABLE booking_payment_state (
 booking_id TEXT NOT NULL PRIMARY KEY REFERENCES booking(id) ON DELETE RESTRICT,
 revision INTEGER NOT NULL CHECK(typeof(revision)='integer' AND revision>0),
 active_event_id TEXT,last_event_id TEXT NOT NULL,
 FOREIGN KEY(active_event_id,booking_id) REFERENCES booking_payment_event(id,booking_id) ON DELETE RESTRICT,
 FOREIGN KEY(last_event_id,booking_id) REFERENCES booking_payment_event(id,booking_id) ON DELETE RESTRICT
);
CREATE TRIGGER booking_payment_event_context BEFORE INSERT ON booking_payment_event
BEGIN
 SELECT RAISE(ABORT,'invalid_payment_context') WHERE NOT EXISTS(
  SELECT 1 FROM booking b JOIN property p ON p.id=b.property_id JOIN user u ON u.id=p.owner_id
  JOIN operation o ON o.id=NEW.id LEFT JOIN booking_payment_state s ON s.booking_id=b.id
  WHERE b.id=NEW.booking_id AND p.owner_id=NEW.actor_id AND u.emailVerified=1
   AND o.actor_id=NEW.actor_id AND o.actor_role='owner' AND o.principal='user:'||NEW.actor_id AND o.result_json IS NULL
   AND o.kind='payment_'||NEW.kind AND NEW.occurred_at=unixepoch() AND NEW.amount_cents=b.total_cents AND b.currency='USD'
   AND NEW.revision=coalesce(s.revision,0)+1 AND (
    (NEW.kind='record' AND b.status IN ('checked_in','completed') AND s.active_event_id IS NULL)
    OR (NEW.kind='void' AND NEW.voids_event_id=s.active_event_id AND EXISTS(SELECT 1 FROM booking_payment_event e WHERE e.id=NEW.voids_event_id AND e.booking_id=b.id AND e.kind='record' AND e.amount_cents=NEW.amount_cents))
   )
 );
END;
CREATE TRIGGER booking_payment_state_insert BEFORE INSERT ON booking_payment_state
BEGIN
 SELECT RAISE(ABORT,'invalid_payment_state') WHERE NOT EXISTS(
 SELECT 1 FROM booking_payment_event e JOIN operation o ON o.id=e.id WHERE e.booking_id=NEW.booking_id AND e.id=NEW.last_event_id AND e.revision=NEW.revision AND o.result_json IS NULL
 AND NEW.active_event_id IS CASE WHEN e.kind='record' THEN e.id ELSE NULL END);
END;
CREATE TRIGGER booking_payment_state_update BEFORE UPDATE ON booking_payment_state
BEGIN
 SELECT RAISE(ABORT,'invalid_payment_state') WHERE NEW.booking_id IS NOT OLD.booking_id OR NEW.revision<>OLD.revision+1 OR NOT EXISTS(
 SELECT 1 FROM booking_payment_event e JOIN operation o ON o.id=e.id WHERE e.booking_id=NEW.booking_id AND e.id=NEW.last_event_id AND e.revision=NEW.revision AND o.result_json IS NULL
 AND NEW.active_event_id IS CASE WHEN e.kind='record' THEN e.id ELSE NULL END);
END;
CREATE TRIGGER booking_payment_project AFTER INSERT ON booking_payment_event
BEGIN
 INSERT INTO booking_payment_state(booking_id,revision,active_event_id,last_event_id) VALUES(NEW.booking_id,NEW.revision,CASE WHEN NEW.kind='record' THEN NEW.id ELSE NULL END,NEW.id)
 ON CONFLICT(booking_id) DO UPDATE SET revision=excluded.revision,active_event_id=excluded.active_event_id,last_event_id=excluded.last_event_id;
END;
CREATE TRIGGER booking_payment_receipt BEFORE UPDATE OF result_json ON operation WHEN NEW.result_json IS NOT NULL AND OLD.result_json IS NULL AND NEW.kind IN ('payment_record','payment_void')
BEGIN
 SELECT RAISE(ABORT,'invalid_payment_receipt') WHERE NOT EXISTS(SELECT 1 FROM booking_payment_state s JOIN booking_payment_event e ON e.id=s.last_event_id WHERE e.id=NEW.id AND json_extract(NEW.result_json,'$.id') IS s.booking_id AND json_extract(NEW.result_json,'$.revision') IS s.revision AND json_extract(NEW.result_json,'$.status') IS CASE WHEN s.active_event_id IS NULL THEN 'not_recorded' ELSE 'recorded' END);
END;
CREATE TRIGGER booking_payment_event_immutable_update BEFORE UPDATE ON booking_payment_event BEGIN SELECT RAISE(ABORT,'immutable_payment_history'); END;
CREATE TRIGGER booking_payment_event_immutable_delete BEFORE DELETE ON booking_payment_event BEGIN SELECT RAISE(ABORT,'retained_payment_history'); END;
CREATE TRIGGER booking_payment_state_retain BEFORE DELETE ON booking_payment_state BEGIN SELECT RAISE(ABORT,'retained_payment_history'); END;
CREATE TABLE booking_payment_attempt (
 id TEXT NOT NULL PRIMARY KEY CHECK(length(id)=36),booking_id TEXT NOT NULL REFERENCES booking(id) ON DELETE RESTRICT,
 actor_id TEXT NOT NULL REFERENCES user(id) ON DELETE RESTRICT,action TEXT NOT NULL CHECK(action IN ('record','void')),
 expected_revision INTEGER NOT NULL CHECK(typeof(expected_revision)='integer' AND expected_revision>=0),
 reason TEXT CHECK(reason IS NULL OR length(reason) BETWEEN 1 AND 2000),fingerprint TEXT NOT NULL,operation_fingerprint TEXT NOT NULL,
 created_at INTEGER NOT NULL DEFAULT(unixepoch()),
 CHECK((action='record' AND reason IS NULL) OR (action='void' AND reason IS NOT NULL))
);
CREATE INDEX booking_payment_attempt_actor ON booking_payment_attempt(actor_id,booking_id,created_at,id);
CREATE TRIGGER booking_payment_attempt_context BEFORE INSERT ON booking_payment_attempt
BEGIN
 SELECT RAISE(ABORT,'invalid_actor') WHERE NOT EXISTS(SELECT 1 FROM booking b JOIN property p ON p.id=b.property_id JOIN user u ON u.id=p.owner_id WHERE b.id=NEW.booking_id AND p.owner_id=NEW.actor_id AND u.emailVerified=1);
END;
CREATE TRIGGER booking_payment_attempt_immutable_update BEFORE UPDATE ON booking_payment_attempt BEGIN SELECT RAISE(ABORT,'immutable_payment_attempt'); END;
CREATE TRIGGER booking_payment_attempt_immutable_delete BEFORE DELETE ON booking_payment_attempt BEGIN SELECT RAISE(ABORT,'retained_payment_attempt'); END;
