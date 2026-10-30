-- Extend the existing guarded ledger; preserve every prior row and receipt.
-- Reopening goes offline to the ordinary draft/review workflow.
DROP TRIGGER listing_control_context;
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
  OR (NEW.action='reopen' AND NEW.from_state='paused' AND NEW.to_state='draft'
    AND EXISTS(SELECT 1 FROM listing_control_event e WHERE e.property_id=NEW.property_id AND e.revision=NEW.revision-1
      AND e.action='pause' AND e.actor_id=NEW.actor_id AND e.review_id IS NEW.review_id))
 );
END;
DROP TRIGGER listing_control_receipt;
CREATE TRIGGER listing_control_receipt BEFORE UPDATE OF result_json ON operation
WHEN NEW.kind IN ('listing_pause','listing_resume','listing_reopen') AND NEW.result_json IS NOT NULL BEGIN
 SELECT RAISE(ABORT,'invalid_listing_receipt') WHERE NOT EXISTS(
  SELECT 1 FROM listing_control_event e WHERE e.operation_id=NEW.id
  AND e.actor_id=NEW.actor_id AND NEW.actor_role='owner' AND NEW.kind='listing_'||e.action
  AND json_extract(NEW.result_json,'$.id')=e.property_id AND json_extract(NEW.result_json,'$.status')=e.to_state
 );
END;
