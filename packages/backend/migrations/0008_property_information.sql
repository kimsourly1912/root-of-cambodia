-- Listing information has an independent version; booking settings/snapshots are retained.
CREATE TABLE property_information (
 property_id TEXT NOT NULL PRIMARY KEY REFERENCES property(id) ON DELETE RESTRICT,
 description_text TEXT NOT NULL CHECK(length(description_text)<=5000 AND instr(description_text,char(0))=0),
 address_text TEXT NOT NULL CHECK(length(address_text)<=1000 AND instr(address_text,char(0))=0),
 facilities_json TEXT NOT NULL CHECK(json_valid(facilities_json) AND json_type(facilities_json)='array' AND json_array_length(facilities_json)<=30),
 revision INTEGER NOT NULL DEFAULT 1 CHECK(typeof(revision)='integer' AND revision>0)
);
CREATE TRIGGER property_information_initial BEFORE INSERT ON property_information BEGIN
 SELECT CASE WHEN NEW.revision<>1 THEN RAISE(ABORT,'invalid_information_revision') END;
END;
CREATE TRIGGER property_information_version BEFORE UPDATE ON property_information BEGIN
 SELECT CASE WHEN NEW.property_id IS NOT OLD.property_id OR NEW.revision<>OLD.revision+1 THEN RAISE(ABORT,'invalid_information_revision') END;
END;
CREATE TRIGGER property_information_facilities_insert BEFORE INSERT ON property_information BEGIN
 SELECT CASE WHEN EXISTS(SELECT 1 FROM json_each(NEW.facilities_json) WHERE type<>'text' OR length(trim(value)) NOT BETWEEN 1 AND 120 OR instr(value,char(0))>0 OR instr(value,char(10))>0 OR instr(value,char(13))>0)
 OR (SELECT count(DISTINCT value) FROM json_each(NEW.facilities_json))<>json_array_length(NEW.facilities_json)
 THEN RAISE(ABORT,'invalid_facilities') END;
END;
CREATE TRIGGER property_information_facilities_update BEFORE UPDATE ON property_information BEGIN
 SELECT CASE WHEN EXISTS(SELECT 1 FROM json_each(NEW.facilities_json) WHERE type<>'text' OR length(trim(value)) NOT BETWEEN 1 AND 120 OR instr(value,char(0))>0 OR instr(value,char(10))>0 OR instr(value,char(13))>0)
 OR (SELECT count(DISTINCT value) FROM json_each(NEW.facilities_json))<>json_array_length(NEW.facilities_json)
 THEN RAISE(ABORT,'invalid_facilities') END;
END;
CREATE TABLE property_information_event (
 operation_id TEXT NOT NULL PRIMARY KEY REFERENCES operation(id) ON DELETE RESTRICT,
 property_id TEXT NOT NULL REFERENCES property_information(property_id) ON DELETE RESTRICT,
 actor_id TEXT NOT NULL REFERENCES user(id) ON DELETE RESTRICT,
 revision INTEGER NOT NULL CHECK(typeof(revision)='integer' AND revision>0),
 occurred_at INTEGER NOT NULL DEFAULT(unixepoch()),
 UNIQUE(property_id,revision)
);
CREATE TRIGGER property_information_event_context BEFORE INSERT ON property_information_event BEGIN
 SELECT CASE WHEN NOT EXISTS(
  SELECT 1 FROM property p JOIN place l ON l.id=p.id JOIN user u ON u.id=p.owner_id
  JOIN property_information d ON d.property_id=p.id JOIN operation o ON o.id=NEW.operation_id
  WHERE p.id=NEW.property_id AND p.owner_id=NEW.actor_id AND u.emailVerified=1 AND l.publication='draft'
   AND d.revision=NEW.revision AND o.actor_id=NEW.actor_id AND o.principal='user:'||NEW.actor_id
   AND o.kind='property_information' AND o.actor_role='owner' AND o.result_json IS NULL
 ) THEN RAISE(ABORT,'invalid_information_actor') END;
END;
CREATE TRIGGER property_information_event_immutable_update BEFORE UPDATE ON property_information_event BEGIN
 SELECT RAISE(ABORT,'immutable_information_history');
END;
CREATE TRIGGER property_information_event_immutable_delete BEFORE DELETE ON property_information_event BEGIN
 SELECT RAISE(ABORT,'immutable_information_history');
END;
