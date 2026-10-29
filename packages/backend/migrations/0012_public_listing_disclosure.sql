-- No backfill: an earlier private upload/review is not public-display consent.
CREATE TABLE public_listing_disclosure (
 request_id TEXT NOT NULL PRIMARY KEY REFERENCES property_review_request(id) ON DELETE RESTRICT,
 owner_id TEXT NOT NULL REFERENCES user(id) ON DELETE RESTRICT,
 policy_version TEXT NOT NULL CHECK(policy_version='public-listing-v1'),
 preview_hash TEXT NOT NULL CHECK(length(preview_hash)=64 AND preview_hash NOT GLOB '*[^0-9a-f]*'),
 confirmed_at INTEGER NOT NULL DEFAULT(unixepoch()) CHECK(typeof(confirmed_at)='integer')
);
CREATE INDEX property_review_latest ON property_review_request(property_id,sequence DESC);
CREATE TRIGGER public_listing_disclosure_context BEFORE INSERT ON public_listing_disclosure BEGIN
 SELECT CASE WHEN NOT EXISTS(
  SELECT 1 FROM property_review_request r JOIN property_review_command c ON c.id=r.id
  JOIN property p ON p.id=r.property_id JOIN place l ON l.id=p.id JOIN user u ON u.id=p.owner_id
  WHERE r.id=NEW.request_id AND r.owner_id=NEW.owner_id AND p.owner_id=NEW.owner_id
  AND r.status='pending' AND r.last_command_id=c.id AND l.publication='review'
  AND c.actor_id=NEW.owner_id AND c.actor_role='owner' AND c.action='submit' AND c.sealed=0
  AND u.emailVerified=1 AND NEW.confirmed_at>=c.created_at AND NEW.confirmed_at<=unixepoch()
 ) THEN RAISE(ABORT,'invalid_public_disclosure') END;
END;
CREATE TRIGGER public_listing_disclosure_immutable_update BEFORE UPDATE ON public_listing_disclosure BEGIN
 SELECT RAISE(ABORT,'immutable_public_disclosure');
END;
CREATE TRIGGER public_listing_disclosure_immutable_delete BEFORE DELETE ON public_listing_disclosure BEGIN
 SELECT RAISE(ABORT,'immutable_public_disclosure');
END;
-- Earlier sealed receipts stay intact/replayable. New submissions must record
-- consent in the same batch before success can be sealed.
CREATE TRIGGER public_listing_submission_seal BEFORE UPDATE ON property_review_command
 WHEN NEW.sealed=1 AND NEW.action='submit' BEGIN
 SELECT CASE WHEN NOT EXISTS(SELECT 1 FROM public_listing_disclosure d
  WHERE d.request_id=NEW.id AND d.owner_id=NEW.actor_id AND d.policy_version='public-listing-v1')
 THEN RAISE(ABORT,'invalid_public_disclosure') END;
END;
CREATE TRIGGER public_listing_approval BEFORE UPDATE ON property_review_request
 WHEN NEW.status='approved' BEGIN
 SELECT CASE WHEN NOT EXISTS(SELECT 1 FROM public_listing_disclosure d
  WHERE d.request_id=NEW.id AND d.owner_id=NEW.owner_id AND d.policy_version='public-listing-v1')
 THEN RAISE(ABORT,'invalid_public_disclosure') END;
END;
