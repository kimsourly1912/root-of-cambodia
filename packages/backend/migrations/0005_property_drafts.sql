-- Private draft history only. Existing catalog/booking records are retained.
CREATE TABLE property_draft_event (
 operation_id TEXT NOT NULL PRIMARY KEY REFERENCES operation(id) ON DELETE RESTRICT,
 property_id TEXT NOT NULL REFERENCES property(id) ON DELETE RESTRICT,
 actor_id TEXT NOT NULL REFERENCES user(id) ON DELETE RESTRICT,
 kind TEXT NOT NULL CHECK(kind IN ('created','updated')),
 revision INTEGER NOT NULL CHECK(typeof(revision)='integer' AND revision>0),
 occurred_at INTEGER NOT NULL DEFAULT (unixepoch()),
 UNIQUE(property_id,revision)
);
CREATE TRIGGER property_draft_event_context BEFORE INSERT ON property_draft_event BEGIN
 SELECT CASE WHEN NOT EXISTS (
  SELECT 1 FROM property p JOIN place l ON l.id=p.id JOIN user u ON u.id=p.owner_id
  JOIN operation o ON o.id=NEW.operation_id
  WHERE p.id=NEW.property_id AND p.owner_id=NEW.actor_id AND u.emailVerified=1
   AND l.publication='draft' AND p.revision=NEW.revision
   AND o.actor_id=NEW.actor_id AND o.principal='user:'||NEW.actor_id AND o.actor_role='owner'
   AND o.result_json IS NULL
   AND ((NEW.kind='created' AND NEW.revision=1 AND o.kind='property_draft_create')
     OR (NEW.kind='updated' AND NEW.revision>1 AND o.kind='property_draft_update'))
 ) THEN RAISE(ABORT,'invalid_draft_actor') END;
END;
CREATE TRIGGER property_draft_event_immutable_update BEFORE UPDATE ON property_draft_event BEGIN
 SELECT RAISE(ABORT,'immutable_draft_history');
END;
CREATE TRIGGER property_draft_event_immutable_delete BEFORE DELETE ON property_draft_event BEGIN
 SELECT RAISE(ABORT,'immutable_draft_history');
END;
