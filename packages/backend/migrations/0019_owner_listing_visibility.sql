-- Owner-attributed visibility history; no old pause/consent events are invented.
CREATE TABLE listing_control_event (
 operation_id TEXT NOT NULL PRIMARY KEY REFERENCES operation(id) ON DELETE RESTRICT,
 property_id TEXT NOT NULL REFERENCES property(id) ON DELETE RESTRICT,
 actor_id TEXT NOT NULL REFERENCES user(id) ON DELETE RESTRICT,
 review_id TEXT REFERENCES property_review_request(id) ON DELETE RESTRICT,
 revision INTEGER NOT NULL CHECK(typeof(revision)='integer' AND revision BETWEEN 1 AND 2147483647),
 action TEXT NOT NULL CHECK(length(action) BETWEEN 1 AND 32),
 from_state TEXT NOT NULL CHECK(from_state IN ('published','paused','draft','review')),
 to_state TEXT NOT NULL CHECK(to_state IN ('published','paused','draft','review')),
 occurred_at INTEGER NOT NULL DEFAULT(unixepoch()),
 UNIQUE(property_id,revision)
);
CREATE TRIGGER listing_control_context BEFORE INSERT ON listing_control_event
BEGIN
 SELECT RAISE(ABORT,'invalid_listing_control') WHERE NOT EXISTS(
  SELECT 1 FROM property p JOIN place l ON l.id=p.id JOIN user u ON u.id=p.owner_id
  JOIN operation o ON o.id=NEW.operation_id
  WHERE p.id=NEW.property_id AND p.owner_id=NEW.actor_id AND u.emailVerified=1
  AND l.publication=NEW.from_state AND o.actor_id=NEW.actor_id AND o.principal='user:'||NEW.actor_id
  AND o.actor_role='owner' AND o.kind='listing_'||NEW.action AND o.result_json IS NULL
 ) OR NEW.revision<>coalesce((SELECT max(revision) FROM listing_control_event WHERE property_id=NEW.property_id),0)+1
 OR NEW.review_id IS NOT (SELECT id FROM property_review_request WHERE property_id=NEW.property_id ORDER BY sequence DESC LIMIT 1);
 SELECT RAISE(ABORT,'invalid_listing_transition') WHERE NOT (
  (NEW.action='pause' AND NEW.from_state='published' AND NEW.to_state='paused')
  OR (NEW.action='resume' AND NEW.from_state='paused' AND NEW.to_state='published'
   AND EXISTS(SELECT 1 FROM listing_control_event e WHERE e.property_id=NEW.property_id AND e.revision=NEW.revision-1
    AND e.action='pause' AND e.actor_id=NEW.actor_id AND e.review_id IS NEW.review_id)
   AND EXISTS(SELECT 1 FROM property_review_request r JOIN property p ON p.id=r.property_id
    JOIN public_listing_disclosure d ON d.request_id=r.id
    WHERE r.id=NEW.review_id AND r.property_id=NEW.property_id AND r.owner_id=NEW.actor_id
    AND r.status='approved' AND p.terms_version=r.approved_terms_version
    AND d.owner_id=NEW.actor_id AND d.policy_version='public-listing-v1'
    AND NOT EXISTS(SELECT 1 FROM json_each(r.snapshot_json,'$.photos') j
      LEFT JOIN property_media m ON m.id=json_extract(j.value,'$.id') AND m.property_id=p.id
      WHERE json_extract(j.value,'$.state')='ready' AND coalesce(m.state,'missing')<>'ready')))
 );
END;
CREATE TRIGGER listing_control_effect AFTER INSERT ON listing_control_event BEGIN
 UPDATE place SET publication=NEW.to_state WHERE id=NEW.property_id;
END;
CREATE TRIGGER listing_control_immutable_update BEFORE UPDATE ON listing_control_event BEGIN SELECT RAISE(ABORT,'immutable_listing_control'); END;
CREATE TRIGGER listing_control_immutable_delete BEFORE DELETE ON listing_control_event BEGIN SELECT RAISE(ABORT,'retained_listing_control'); END;
CREATE TRIGGER listing_control_receipt BEFORE UPDATE OF result_json ON operation
WHEN NEW.kind IN ('listing_pause','listing_resume') AND NEW.result_json IS NOT NULL BEGIN
 SELECT RAISE(ABORT,'invalid_listing_receipt') WHERE NOT EXISTS(
  SELECT 1 FROM listing_control_event e WHERE e.operation_id=NEW.id
  AND e.actor_id=NEW.actor_id AND NEW.actor_role='owner' AND NEW.kind='listing_'||e.action
  AND json_extract(NEW.result_json,'$.id')=e.property_id AND json_extract(NEW.result_json,'$.status')=e.to_state
 );
END;
