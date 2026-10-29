-- One explicitly provisioned pilot reviewer; no browser role-grant path.
CREATE TABLE pilot_publication_config (
 singleton INTEGER PRIMARY KEY CHECK(singleton=1),
 reviewer_user_id TEXT NOT NULL REFERENCES user(id) ON DELETE RESTRICT,
 terms_version TEXT CHECK(terms_version IS NULL OR (length(trim(terms_version)) BETWEEN 1 AND 100 AND terms_version<>'unconfigured')),
 revision INTEGER NOT NULL DEFAULT 1 CHECK(typeof(revision)='integer' AND revision>0)
);
CREATE TRIGGER pilot_publication_config_initial BEFORE INSERT ON pilot_publication_config BEGIN
 SELECT CASE WHEN NEW.revision<>1 THEN RAISE(ABORT,'invalid_review_config') END;
END;
CREATE TRIGGER pilot_publication_config_version BEFORE UPDATE ON pilot_publication_config BEGIN
 SELECT CASE WHEN NEW.singleton<>OLD.singleton OR NEW.revision<>OLD.revision+1 THEN RAISE(ABORT,'invalid_review_config') END;
END;
-- Review commands have their own owner/reviewer role vocabulary. Existing booking
-- operation roles, fingerprints, receipts and applied migrations are unchanged.
CREATE TABLE property_review_command (
 id TEXT NOT NULL PRIMARY KEY,
 actor_id TEXT NOT NULL REFERENCES user(id) ON DELETE RESTRICT,
 actor_role TEXT NOT NULL CHECK(actor_role IN ('owner','reviewer')),
 key TEXT NOT NULL CHECK(length(key) BETWEEN 1 AND 128),
 fingerprint TEXT NOT NULL,
 action TEXT NOT NULL CHECK(action IN ('submit','withdraw','return_changes','approve')),
 result_json TEXT CHECK(result_json IS NULL OR json_valid(result_json)),
 sealed INTEGER NOT NULL DEFAULT 0 CHECK(sealed IN (0,1)),
 created_at INTEGER NOT NULL DEFAULT(unixepoch()),
 UNIQUE(actor_id,key),
 CHECK(sealed=0 OR result_json IS NOT NULL)
);
CREATE TRIGGER property_review_command_initial BEFORE INSERT ON property_review_command BEGIN
 SELECT CASE WHEN NEW.sealed<>0 OR NEW.result_json IS NOT NULL OR NOT EXISTS(
  SELECT 1 FROM user WHERE id=NEW.actor_id AND emailVerified=1
 ) OR (NEW.actor_role='reviewer' AND NOT EXISTS(
  SELECT 1 FROM pilot_publication_config WHERE singleton=1 AND reviewer_user_id=NEW.actor_id
 )) OR (NEW.action IN ('submit','withdraw') AND NEW.actor_role<>'owner')
 OR (NEW.action IN ('return_changes','approve') AND NEW.actor_role<>'reviewer')
 THEN RAISE(ABORT,'invalid_review_actor') END;
END;
CREATE TRIGGER property_review_command_immutable BEFORE UPDATE ON property_review_command BEGIN
 SELECT CASE WHEN OLD.sealed=1 OR NEW.id IS NOT OLD.id OR NEW.actor_id IS NOT OLD.actor_id
 OR NEW.actor_role IS NOT OLD.actor_role OR NEW.key IS NOT OLD.key OR NEW.fingerprint IS NOT OLD.fingerprint
 OR NEW.action IS NOT OLD.action OR NEW.created_at IS NOT OLD.created_at OR NEW.sealed<>1
 THEN RAISE(ABORT,'immutable_review_command') END;
END;
CREATE TRIGGER property_review_command_retain BEFORE DELETE ON property_review_command BEGIN
 SELECT RAISE(ABORT,'immutable_review_command');
END;
CREATE TABLE property_review_request (
 sequence INTEGER PRIMARY KEY AUTOINCREMENT,
 id TEXT NOT NULL UNIQUE REFERENCES property_review_command(id) ON DELETE RESTRICT,
 property_id TEXT NOT NULL REFERENCES property(id) ON DELETE RESTRICT,
 owner_id TEXT NOT NULL REFERENCES user(id) ON DELETE RESTRICT,
 status TEXT NOT NULL CHECK(status IN ('pending','withdrawn','returned','approved')),
 revision INTEGER NOT NULL DEFAULT 1 CHECK(typeof(revision)='integer' AND revision>0),
 snapshot_json TEXT NOT NULL CHECK(json_valid(snapshot_json) AND json_type(snapshot_json)='object'),
 last_command_id TEXT NOT NULL REFERENCES property_review_command(id) ON DELETE RESTRICT,
 approved_terms_version TEXT,
 submitted_at INTEGER NOT NULL DEFAULT(unixepoch()),
 CHECK((status='approved' AND approved_terms_version IS NOT NULL AND length(approved_terms_version)>0 AND approved_terms_version<>'unconfigured')
 OR (status<>'approved' AND approved_terms_version IS NULL))
);
CREATE UNIQUE INDEX one_pending_property_review ON property_review_request(property_id) WHERE status='pending';
CREATE INDEX property_review_owner ON property_review_request(property_id,owner_id,sequence);
CREATE INDEX property_review_queue ON property_review_request(status,sequence);
CREATE TRIGGER property_review_request_initial BEFORE INSERT ON property_review_request BEGIN
 SELECT CASE WHEN NEW.status<>'pending' OR NEW.revision<>1 OR NEW.last_command_id<>NEW.id
 OR NOT EXISTS(
  SELECT 1 FROM property p JOIN place l ON l.id=p.id JOIN user u ON u.id=p.owner_id
  JOIN property_review_command c ON c.id=NEW.id
  WHERE p.id=NEW.property_id AND p.owner_id=NEW.owner_id AND u.emailVerified=1 AND l.publication='review'
  AND c.actor_id=NEW.owner_id AND c.actor_role='owner' AND c.action='submit' AND c.sealed=0
 ) OR json_extract(NEW.snapshot_json,'$.property.id') IS NOT NEW.property_id
 OR json_extract(NEW.snapshot_json,'$.property.ownerId') IS NOT NEW.owner_id
 THEN RAISE(ABORT,'invalid_review_submission') END;
END;
CREATE TRIGGER property_review_request_transition BEFORE UPDATE ON property_review_request BEGIN
 SELECT CASE WHEN OLD.status<>'pending' OR NEW.status NOT IN ('withdrawn','returned','approved')
 OR NEW.revision<>OLD.revision+1 OR NEW.sequence IS NOT OLD.sequence OR NEW.id IS NOT OLD.id
 OR NEW.property_id IS NOT OLD.property_id OR NEW.owner_id IS NOT OLD.owner_id
 OR NEW.snapshot_json IS NOT OLD.snapshot_json OR NEW.submitted_at IS NOT OLD.submitted_at
 OR NEW.last_command_id IS OLD.last_command_id
 THEN RAISE(ABORT,'invalid_review_transition') END;
END;
CREATE TRIGGER property_review_request_retain BEFORE DELETE ON property_review_request BEGIN
 SELECT RAISE(ABORT,'immutable_review_history');
END;
CREATE TABLE property_review_event (
 command_id TEXT NOT NULL PRIMARY KEY REFERENCES property_review_command(id) ON DELETE RESTRICT,
 request_id TEXT NOT NULL REFERENCES property_review_request(id) ON DELETE RESTRICT,
 actor_id TEXT NOT NULL REFERENCES user(id) ON DELETE RESTRICT,
 actor_role TEXT NOT NULL CHECK(actor_role IN ('owner','reviewer')),
 action TEXT NOT NULL CHECK(action IN ('submit','withdraw','return_changes','approve')),
 reason TEXT CHECK(reason IS NULL OR length(trim(reason)) BETWEEN 1 AND 2000),
 occurred_at INTEGER NOT NULL DEFAULT(unixepoch())
);
CREATE TRIGGER property_review_event_context BEFORE INSERT ON property_review_event BEGIN
 SELECT CASE WHEN NOT EXISTS(
  SELECT 1 FROM property_review_command c JOIN property_review_request r ON r.last_command_id=c.id
  JOIN property p ON p.id=r.property_id JOIN place l ON l.id=p.id JOIN user u ON u.id=NEW.actor_id
  WHERE c.id=NEW.command_id AND r.id=NEW.request_id AND c.actor_id=NEW.actor_id AND c.actor_role=NEW.actor_role
  AND c.action=NEW.action AND c.sealed=0 AND u.emailVerified=1 AND p.owner_id=r.owner_id
  AND (
   (NEW.action='submit' AND NEW.actor_role='owner' AND NEW.actor_id=r.owner_id AND r.status='pending' AND l.publication='review')
   OR (NEW.action='withdraw' AND NEW.actor_role='owner' AND NEW.actor_id=r.owner_id AND r.status='withdrawn' AND l.publication='draft')
   OR (NEW.action='return_changes' AND NEW.actor_role='reviewer' AND r.status='returned' AND l.publication='draft' AND NEW.reason IS NOT NULL
    AND EXISTS(SELECT 1 FROM pilot_publication_config WHERE singleton=1 AND reviewer_user_id=NEW.actor_id))
   OR (NEW.action='approve' AND NEW.actor_role='reviewer' AND r.status='approved' AND l.publication='published'
    AND EXISTS(SELECT 1 FROM pilot_publication_config f JOIN user owner ON owner.id=r.owner_id
     WHERE f.singleton=1 AND f.reviewer_user_id=NEW.actor_id AND f.terms_version=r.approved_terms_version
     AND p.terms_version=f.terms_version AND owner.emailVerified=1))
  )
 ) THEN RAISE(ABORT,'invalid_review_event') END;
END;
CREATE TRIGGER property_review_event_immutable_update BEFORE UPDATE ON property_review_event BEGIN
 SELECT RAISE(ABORT,'immutable_review_history');
END;
CREATE TRIGGER property_review_event_immutable_delete BEFORE DELETE ON property_review_event BEGIN
 SELECT RAISE(ABORT,'immutable_review_history');
END;

CREATE TRIGGER property_review_command_seal BEFORE UPDATE ON property_review_command WHEN NEW.sealed=1 BEGIN
 SELECT CASE WHEN NOT EXISTS(
  SELECT 1 FROM property_review_event e JOIN property_review_request r ON r.id=e.request_id
  WHERE e.command_id=NEW.id AND json_extract(NEW.result_json,'$.id')=r.id AND json_extract(NEW.result_json,'$.status')=r.status
 ) THEN RAISE(ABORT,'invalid_review_receipt') END;
END;
