-- Owner applications and admin decisions (ADR 0010, slice 3). A verified account
-- applies; a different active admin approves or declines with a reason. Every
-- command is an immutable receipt and history row committed with its effect.

CREATE TABLE owner_application (
 user_id TEXT PRIMARY KEY REFERENCES owner_access(user_id) ON DELETE RESTRICT,
 business_name TEXT NOT NULL CHECK(length(trim(business_name)) BETWEEN 1 AND 200),
 phone TEXT NOT NULL CHECK(length(trim(phone)) BETWEEN 6 AND 40),
 province TEXT NOT NULL CHECK(length(trim(province)) BETWEEN 1 AND 100),
 -- Owner terms acceptance waits for approved owner terms (D15); always null now.
 terms_version TEXT CHECK(terms_version IS NULL),
 revision INTEGER NOT NULL CHECK(typeof(revision)='integer' AND revision>0),
 submitted_at INTEGER NOT NULL DEFAULT(unixepoch())
);
CREATE TABLE owner_access_command (
 id TEXT PRIMARY KEY,
 actor_id TEXT NOT NULL REFERENCES user(id) ON DELETE RESTRICT,
 actor_role TEXT NOT NULL CHECK(actor_role IN ('applicant','admin')),
 key TEXT NOT NULL CHECK(length(key) BETWEEN 1 AND 128),
 fingerprint TEXT NOT NULL,
 action TEXT NOT NULL CHECK(action IN ('apply','approve','decline')),
 subject_id TEXT NOT NULL REFERENCES user(id) ON DELETE RESTRICT,
 reason TEXT CHECK(reason IS NULL OR length(trim(reason)) BETWEEN 1 AND 1000),
 result_json TEXT CHECK(result_json IS NULL OR json_valid(result_json)),
 occurred_at INTEGER NOT NULL DEFAULT(unixepoch()),
 UNIQUE(actor_id,key),
 CHECK((action='apply')=(actor_role='applicant')),
 CHECK(action='apply' OR reason IS NOT NULL)
);
CREATE INDEX owner_access_command_subject ON owner_access_command(subject_id,occurred_at);
CREATE INDEX owner_access_status ON owner_access(status,created_at);
-- A failing check aborts its whole batch, including the command receipt.
CREATE TABLE owner_access_assert (
 command_id TEXT PRIMARY KEY REFERENCES owner_access_command(id) ON DELETE RESTRICT,
 ok INTEGER NOT NULL CHECK(ok=1)
);

CREATE TRIGGER owner_access_command_actor BEFORE INSERT ON owner_access_command BEGIN
 SELECT RAISE(ABORT,'invalid_owner_access_actor') WHERE NEW.result_json IS NOT NULL
 OR NOT EXISTS(SELECT 1 FROM user WHERE id=NEW.actor_id AND emailVerified=1)
 OR (NEW.actor_role='applicant' AND NEW.actor_id<>NEW.subject_id)
 OR (NEW.actor_role='admin' AND (NEW.actor_id=NEW.subject_id OR NOT EXISTS(
  SELECT 1 FROM platform_staff WHERE user_id=NEW.actor_id AND role='admin' AND active=1)));
END;
CREATE TRIGGER owner_access_command_sealed BEFORE UPDATE ON owner_access_command BEGIN
 SELECT RAISE(ABORT,'immutable_owner_access_command') WHERE OLD.result_json IS NOT NULL
 OR NEW.id IS NOT OLD.id OR NEW.actor_id IS NOT OLD.actor_id OR NEW.actor_role IS NOT OLD.actor_role
 OR NEW.key IS NOT OLD.key OR NEW.fingerprint IS NOT OLD.fingerprint OR NEW.action IS NOT OLD.action
 OR NEW.subject_id IS NOT OLD.subject_id OR NEW.reason IS NOT OLD.reason OR NEW.occurred_at IS NOT OLD.occurred_at;
END;
CREATE TRIGGER owner_access_command_retained BEFORE DELETE ON owner_access_command BEGIN
 SELECT RAISE(ABORT,'immutable_owner_access_command');
END;
-- Approved access has no exit until suspension is decided (D06).
CREATE TRIGGER owner_access_approved_final BEFORE UPDATE ON owner_access
WHEN OLD.status='approved' BEGIN
 SELECT RAISE(ABORT,'invalid_owner_access_decision');
END;
-- An admin decision on an application needs that admin's in-flight command.
CREATE TRIGGER owner_access_decision BEFORE UPDATE OF status ON owner_access
WHEN OLD.status='pending' AND NEW.status IN ('approved','declined') BEGIN
 SELECT RAISE(ABORT,'invalid_owner_access_decision') WHERE NEW.decided_by IS NULL OR NOT EXISTS(
  SELECT 1 FROM owner_access_command c WHERE c.subject_id=NEW.user_id AND c.actor_id=NEW.decided_by
  AND c.actor_role='admin' AND c.result_json IS NULL
  AND c.action=CASE NEW.status WHEN 'approved' THEN 'approve' ELSE 'decline' END);
END;

-- Creating a property needs approved owner access (ADR 0010). Enforced on insert
-- inside the creating batch; existing properties are unaffected.
CREATE TRIGGER property_owner_access BEFORE INSERT ON property BEGIN
 SELECT RAISE(ABORT,'owner_access_required') WHERE NOT EXISTS(
  SELECT 1 FROM owner_access WHERE user_id=NEW.owner_id AND status='approved');
END;
