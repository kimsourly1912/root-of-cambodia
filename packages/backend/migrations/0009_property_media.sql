-- Private draft media. Stable object identities and removal tombstones allow
-- recovery across D1/R2 failures; neither system pretends to transact with the other.
CREATE TABLE property_media (
 id TEXT NOT NULL PRIMARY KEY REFERENCES operation(id) ON DELETE RESTRICT,
 property_id TEXT NOT NULL REFERENCES property(id) ON DELETE RESTRICT,
 content_type TEXT NOT NULL CHECK(content_type IN ('image/jpeg','image/png','image/webp')),
 byte_size INTEGER NOT NULL CHECK(typeof(byte_size)='integer' AND byte_size BETWEEN 1 AND 8388608),
 sha256 TEXT NOT NULL CHECK(length(sha256)=64 AND sha256 NOT GLOB '*[^0-9a-f]*'),
 state TEXT NOT NULL DEFAULT 'pending' CHECK(state IN ('pending','ready','removed')),
 width INTEGER,
 height INTEGER,
 cleanup_at INTEGER,
 cleanup_attempts INTEGER NOT NULL DEFAULT 0 CHECK(typeof(cleanup_attempts)='integer' AND cleanup_attempts>=0),
 cleanup_failures INTEGER NOT NULL DEFAULT 0 CHECK(typeof(cleanup_failures)='integer' AND cleanup_failures>=0),
 CHECK(state<>'ready' OR (typeof(width)='integer' AND typeof(height)='integer' AND width BETWEEN 1 AND 8000 AND height BETWEEN 1 AND 8000 AND width*height<=24000000)),
 CHECK((state='removed')=(cleanup_at IS NOT NULL))
);
CREATE INDEX property_media_property ON property_media(property_id,state,id);
CREATE INDEX property_media_cleanup ON property_media(state,cleanup_at,id);
CREATE TABLE property_media_gallery (
 property_id TEXT NOT NULL PRIMARY KEY REFERENCES property(id) ON DELETE RESTRICT,
 ids_json TEXT NOT NULL CHECK(json_valid(ids_json) AND json_type(ids_json)='array' AND json_array_length(ids_json)<=20),
 revision INTEGER NOT NULL DEFAULT 1 CHECK(typeof(revision)='integer' AND revision>0)
);
CREATE TRIGGER property_media_gallery_initial BEFORE INSERT ON property_media_gallery BEGIN
 SELECT CASE WHEN NEW.revision<>1 THEN RAISE(ABORT,'invalid_media_revision') END;
END;
CREATE TRIGGER property_media_gallery_version BEFORE UPDATE ON property_media_gallery BEGIN
 SELECT CASE WHEN NEW.property_id IS NOT OLD.property_id OR NEW.revision<>OLD.revision+1 THEN RAISE(ABORT,'invalid_media_revision') END;
END;
CREATE TRIGGER property_media_identity BEFORE UPDATE ON property_media BEGIN
 SELECT CASE WHEN NEW.id IS NOT OLD.id OR NEW.property_id IS NOT OLD.property_id OR NEW.content_type IS NOT OLD.content_type
  OR NEW.byte_size IS NOT OLD.byte_size OR NEW.sha256 IS NOT OLD.sha256
  OR (OLD.state='ready' AND NEW.state NOT IN ('ready','removed')) OR (OLD.state='removed' AND NEW.state<>'removed')
  OR (OLD.state<>'pending' AND (NEW.width IS NOT OLD.width OR NEW.height IS NOT OLD.height))
 THEN RAISE(ABORT,'invalid_media_transition') END;
END;
CREATE TRIGGER property_media_initial BEFORE INSERT ON property_media BEGIN
 SELECT CASE WHEN NEW.state<>'pending' OR NEW.width IS NOT NULL OR NEW.height IS NOT NULL OR NEW.cleanup_at IS NOT NULL OR NEW.cleanup_attempts<>0 OR NEW.cleanup_failures<>0
 THEN RAISE(ABORT,'invalid_media_initial') END;
END;
CREATE TRIGGER property_media_no_delete BEFORE DELETE ON property_media BEGIN
 SELECT RAISE(ABORT,'immutable_media_identity');
END;
CREATE TRIGGER property_media_gallery_no_delete BEFORE DELETE ON property_media_gallery BEGIN
 SELECT RAISE(ABORT,'immutable_media_gallery');
END;
CREATE TABLE property_media_event (
 operation_id TEXT NOT NULL PRIMARY KEY REFERENCES operation(id) ON DELETE RESTRICT,
 property_id TEXT NOT NULL REFERENCES property_media_gallery(property_id) ON DELETE RESTRICT,
 actor_id TEXT NOT NULL REFERENCES user(id) ON DELETE RESTRICT,
 revision INTEGER NOT NULL CHECK(typeof(revision)='integer' AND revision>0),
 occurred_at INTEGER NOT NULL DEFAULT(unixepoch()),
 UNIQUE(property_id,revision)
);
CREATE TRIGGER property_media_event_context BEFORE INSERT ON property_media_event BEGIN
 SELECT CASE WHEN NOT EXISTS(
  SELECT 1 FROM property p JOIN place l ON l.id=p.id JOIN user u ON u.id=p.owner_id
  JOIN property_media_gallery g ON g.property_id=p.id JOIN operation o ON o.id=NEW.operation_id
  WHERE p.id=NEW.property_id AND p.owner_id=NEW.actor_id AND u.emailVerified=1 AND l.publication='draft'
   AND g.revision=NEW.revision AND o.actor_id=NEW.actor_id AND o.principal='user:'||NEW.actor_id
   AND o.kind IN ('media_register','media_ready','media_reorder','media_remove') AND o.actor_role='owner' AND o.result_json IS NULL
 ) THEN RAISE(ABORT,'invalid_media_actor') END;
 -- Validate the final complete gallery inside the same atomic operation.
 SELECT CASE WHEN EXISTS(
  SELECT 1 FROM property_media_gallery g,json_each(g.ids_json) j WHERE g.property_id=NEW.property_id
   AND (j.type<>'text' OR NOT EXISTS(SELECT 1 FROM property_media m WHERE m.id=j.value AND m.property_id=g.property_id AND m.state<>'removed'))
 ) OR EXISTS(
  SELECT 1 FROM property_media m WHERE m.property_id=NEW.property_id AND m.state<>'removed'
   AND NOT EXISTS(SELECT 1 FROM property_media_gallery g,json_each(g.ids_json) j WHERE g.property_id=m.property_id AND j.value=m.id)
 ) OR (SELECT count(DISTINCT j.value) FROM property_media_gallery g,json_each(g.ids_json) j WHERE g.property_id=NEW.property_id)
  <>(SELECT json_array_length(ids_json) FROM property_media_gallery WHERE property_id=NEW.property_id)
 THEN RAISE(ABORT,'invalid_media_gallery') END;
END;
CREATE TRIGGER property_media_event_immutable_update BEFORE UPDATE ON property_media_event BEGIN
 SELECT RAISE(ABORT,'immutable_media_history');
END;
CREATE TRIGGER property_media_event_immutable_delete BEFORE DELETE ON property_media_event BEGIN
 SELECT RAISE(ABORT,'immutable_media_history');
END;
