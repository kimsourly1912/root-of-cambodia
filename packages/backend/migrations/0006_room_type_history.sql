-- Private room-type setup only. Existing rooms, stock and bookings are retained.
CREATE TABLE room_type_event (
 operation_id TEXT NOT NULL PRIMARY KEY REFERENCES operation(id) ON DELETE RESTRICT,
 room_type_id TEXT NOT NULL REFERENCES room_type(id) ON DELETE RESTRICT,
 actor_id TEXT NOT NULL REFERENCES user(id) ON DELETE RESTRICT,
 kind TEXT NOT NULL CHECK(kind IN ('created','updated')),
 revision INTEGER NOT NULL CHECK(typeof(revision)='integer' AND revision>0),
 occurred_at INTEGER NOT NULL DEFAULT (unixepoch()),
 UNIQUE(room_type_id,revision)
);
CREATE TRIGGER room_type_event_context BEFORE INSERT ON room_type_event BEGIN
 SELECT CASE WHEN NOT EXISTS (
  SELECT 1 FROM room_type r JOIN property p ON p.id=r.property_id
  JOIN place l ON l.id=p.id JOIN user u ON u.id=p.owner_id
  JOIN operation o ON o.id=NEW.operation_id
  WHERE r.id=NEW.room_type_id AND p.owner_id=NEW.actor_id AND u.emailVerified=1
   AND l.publication='draft' AND r.revision=NEW.revision
   AND o.actor_id=NEW.actor_id AND o.principal='user:'||NEW.actor_id AND o.actor_role='owner'
   AND o.result_json IS NULL
   AND ((NEW.kind='created' AND NEW.revision=1 AND o.kind='room_type_create')
     OR (NEW.kind='updated' AND NEW.revision>1 AND o.kind='room_type_update'))
 ) THEN RAISE(ABORT,'invalid_room_actor') END;
END;
CREATE TRIGGER room_type_event_immutable_update BEFORE UPDATE ON room_type_event BEGIN
 SELECT RAISE(ABORT,'immutable_room_history');
END;
CREATE TRIGGER room_type_event_immutable_delete BEFORE DELETE ON room_type_event BEGIN
 SELECT RAISE(ABORT,'immutable_room_history');
END;
