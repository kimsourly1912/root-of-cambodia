-- Account capabilities (ADR 0010). Guest stays implicit: every verified account.
-- Platform admin and approved owner are explicit rows read on every request and
-- rechecked inside writes. Existing rows, receipts and migrations are unchanged.

-- Admin grants come only from a trusted operator command. Each change to a
-- staff row needs the matching immutable event in the same batch.
CREATE TABLE platform_staff_event (
 id INTEGER PRIMARY KEY AUTOINCREMENT,
 user_id TEXT NOT NULL REFERENCES user(id) ON DELETE RESTRICT,
 action TEXT NOT NULL CHECK(action IN ('grant','revoke')),
 revision INTEGER NOT NULL CHECK(typeof(revision)='integer' AND revision>0),
 operator TEXT NOT NULL CHECK(length(trim(operator)) BETWEEN 1 AND 100),
 reason TEXT NOT NULL CHECK(length(trim(reason)) BETWEEN 1 AND 500),
 occurred_at INTEGER NOT NULL DEFAULT(unixepoch()),
 UNIQUE(user_id,revision)
);
CREATE TABLE platform_staff (
 user_id TEXT PRIMARY KEY REFERENCES user(id) ON DELETE RESTRICT,
 role TEXT NOT NULL CHECK(role='admin'),
 active INTEGER NOT NULL CHECK(active IN (0,1)),
 revision INTEGER NOT NULL CHECK(typeof(revision)='integer' AND revision>0),
 FOREIGN KEY(user_id,revision) REFERENCES platform_staff_event(user_id,revision) ON DELETE RESTRICT
);

-- Owner access. Applications and admin decisions arrive in a later slice; the
-- statuses are defined now because SQLite cannot widen a CHECK in place.
CREATE TABLE owner_access (
 user_id TEXT PRIMARY KEY REFERENCES user(id) ON DELETE RESTRICT,
 status TEXT NOT NULL CHECK(status IN ('pending','approved','declined')),
 source TEXT NOT NULL CHECK(source IN ('backfill','application')),
 decided_by TEXT REFERENCES user(id) ON DELETE RESTRICT,
 decided_at INTEGER,
 created_at INTEGER NOT NULL DEFAULT(unixepoch()),
 CHECK((status='pending')=(decided_at IS NULL)),
 CHECK(source<>'backfill' OR (status='approved' AND decided_by IS NULL))
);

-- Backfill before the guards below: every account that already owns a property
-- keeps owner access, and the configured pilot reviewer becomes the first admin.
INSERT INTO owner_access(user_id,status,source,decided_at)
 SELECT DISTINCT owner_id,'approved','backfill',unixepoch() FROM property;
INSERT INTO platform_staff_event(user_id,action,revision,operator,reason)
 SELECT reviewer_user_id,'grant',1,'migration-0021','Configured pilot publication reviewer'
 FROM pilot_publication_config WHERE singleton=1;
INSERT INTO platform_staff(user_id,role,active,revision)
 SELECT reviewer_user_id,'admin',1,1 FROM pilot_publication_config WHERE singleton=1;

CREATE TRIGGER platform_staff_event_immutable BEFORE UPDATE ON platform_staff_event BEGIN
 SELECT RAISE(ABORT,'immutable_staff_event');
END;
CREATE TRIGGER platform_staff_event_retained BEFORE DELETE ON platform_staff_event BEGIN
 SELECT RAISE(ABORT,'immutable_staff_event');
END;
CREATE TRIGGER platform_staff_event_sequence BEFORE INSERT ON platform_staff_event BEGIN
 SELECT RAISE(ABORT,'invalid_staff_event') WHERE NEW.revision<>coalesce(
  (SELECT max(revision) FROM platform_staff_event WHERE user_id=NEW.user_id),0)+1
 OR (NEW.action='grant' AND NOT EXISTS(SELECT 1 FROM user WHERE id=NEW.user_id AND emailVerified=1));
END;
CREATE TRIGGER platform_staff_insert BEFORE INSERT ON platform_staff BEGIN
 SELECT RAISE(ABORT,'invalid_staff_change') WHERE NEW.revision<>1 OR NOT EXISTS(
  SELECT 1 FROM platform_staff_event WHERE user_id=NEW.user_id AND revision=1
  AND action=CASE NEW.active WHEN 1 THEN 'grant' ELSE 'revoke' END);
END;
CREATE TRIGGER platform_staff_update BEFORE UPDATE ON platform_staff BEGIN
 SELECT RAISE(ABORT,'invalid_staff_change') WHERE NEW.user_id IS NOT OLD.user_id
 OR NEW.revision<>OLD.revision+1 OR NOT EXISTS(
  SELECT 1 FROM platform_staff_event WHERE user_id=NEW.user_id AND revision=NEW.revision
  AND action=CASE NEW.active WHEN 1 THEN 'grant' ELSE 'revoke' END);
END;
CREATE TRIGGER platform_staff_retained BEFORE DELETE ON platform_staff BEGIN
 SELECT RAISE(ABORT,'invalid_staff_change');
END;
CREATE TRIGGER owner_access_identity BEFORE UPDATE OF user_id,source ON owner_access BEGIN
 SELECT RAISE(ABORT,'invalid_owner_access');
END;

-- Publication review permission becomes "active verified admin". The pilot
-- configuration keeps its terms version and revision fence; reviewer_user_id
-- is retained for earlier rows and no longer grants review.
DROP TRIGGER property_review_command_initial;
CREATE TRIGGER property_review_command_initial BEFORE INSERT ON property_review_command BEGIN
 SELECT CASE WHEN NEW.sealed<>0 OR NEW.result_json IS NOT NULL OR NOT EXISTS(
  SELECT 1 FROM user WHERE id=NEW.actor_id AND emailVerified=1
 ) OR (NEW.actor_role='reviewer' AND NOT EXISTS(
  SELECT 1 FROM platform_staff WHERE user_id=NEW.actor_id AND role='admin' AND active=1
 )) OR (NEW.action IN ('submit','withdraw') AND NEW.actor_role<>'owner')
 OR (NEW.action IN ('return_changes','approve') AND NEW.actor_role<>'reviewer')
 THEN RAISE(ABORT,'invalid_review_actor') END;
END;
