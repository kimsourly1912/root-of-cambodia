-- Private owner-entered details only; publication/disclosure policy is unchanged.
CREATE TABLE property_logistics (
 property_id TEXT NOT NULL PRIMARY KEY REFERENCES property(id) ON DELETE RESTRICT,
 latitude REAL CHECK(latitude IS NULL OR (typeof(latitude) IN ('real','integer') AND latitude BETWEEN -90 AND 90)),
 longitude REAL CHECK(longitude IS NULL OR (typeof(longitude) IN ('real','integer') AND longitude BETWEEN -180 AND 180)),
 contact_name TEXT NOT NULL CHECK(length(contact_name)<=200 AND instr(contact_name,char(0))=0),
 contact_phone TEXT NOT NULL CHECK(length(contact_phone)<=100 AND instr(contact_phone,char(0))=0),
 contact_email TEXT NOT NULL CHECK(length(contact_email)<=254 AND instr(contact_email,char(0))=0),
 arrival_instructions TEXT NOT NULL CHECK(length(arrival_instructions)<=5000 AND instr(arrival_instructions,char(0))=0),
 revision INTEGER NOT NULL DEFAULT 1 CHECK(typeof(revision)='integer' AND revision>0),
 CHECK((latitude IS NULL)=(longitude IS NULL))
);
CREATE TRIGGER property_logistics_initial BEFORE INSERT ON property_logistics BEGIN
 SELECT CASE WHEN NEW.revision<>1 THEN RAISE(ABORT,'invalid_logistics_revision') END;
END;
CREATE TRIGGER property_logistics_version BEFORE UPDATE ON property_logistics BEGIN
 SELECT CASE WHEN NEW.property_id IS NOT OLD.property_id OR NEW.revision<>OLD.revision+1
 THEN RAISE(ABORT,'invalid_logistics_revision') END;
END;
CREATE TABLE property_logistics_event (
 operation_id TEXT NOT NULL PRIMARY KEY REFERENCES operation(id) ON DELETE RESTRICT,
 property_id TEXT NOT NULL REFERENCES property_logistics(property_id) ON DELETE RESTRICT,
 actor_id TEXT NOT NULL REFERENCES user(id) ON DELETE RESTRICT,
 revision INTEGER NOT NULL CHECK(typeof(revision)='integer' AND revision>0),
 occurred_at INTEGER NOT NULL DEFAULT(unixepoch()),
 UNIQUE(property_id,revision)
);
CREATE TRIGGER property_logistics_event_context BEFORE INSERT ON property_logistics_event BEGIN
 SELECT CASE WHEN NOT EXISTS(
  SELECT 1 FROM property p JOIN place l ON l.id=p.id JOIN user u ON u.id=p.owner_id
  JOIN property_logistics d ON d.property_id=p.id JOIN operation o ON o.id=NEW.operation_id
  WHERE p.id=NEW.property_id AND p.owner_id=NEW.actor_id AND u.emailVerified=1 AND l.publication='draft'
   AND d.revision=NEW.revision AND o.actor_id=NEW.actor_id AND o.principal='user:'||NEW.actor_id
   AND o.kind='property_logistics' AND o.actor_role='owner' AND o.result_json IS NULL
 ) THEN RAISE(ABORT,'invalid_logistics_actor') END;
END;
CREATE TRIGGER property_logistics_event_immutable_update BEFORE UPDATE ON property_logistics_event BEGIN
 SELECT RAISE(ABORT,'immutable_logistics_history');
END;
CREATE TRIGGER property_logistics_event_immutable_delete BEFORE DELETE ON property_logistics_event BEGIN
 SELECT RAISE(ABORT,'immutable_logistics_history');
END;
