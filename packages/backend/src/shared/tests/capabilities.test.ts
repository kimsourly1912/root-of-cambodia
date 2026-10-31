import { env } from "cloudflare:workers";
import { test } from "vitest";
import assert from "node:assert/strict";
import {
  database,
  migrate,
  catalog,
  owner,
  other,
  guest,
  unverified,
  configureReviewer,
  grantAdminStatements,
} from "../../testing/support";
import { capabilities } from "@root-of-cambodia/backend/shared";
import { canReview } from "@root-of-cambodia/backend/publication";

test("populated 0020 upgrade backfills current owners and the configured reviewer as the first admin", async () => {
  const p = await database({ migrate: false });
  try {
    const db = p.db;
    await migrate(db, env.TEST_MIGRATIONS.filter((m) => m.name < "0021").map((m) => m.name));
    await catalog(db);
    await db.prepare("INSERT INTO pilot_publication_config VALUES(1,'guest','approved-v1',1)").run();
    const config = await db.prepare("SELECT * FROM pilot_publication_config").first();
    await migrate(db);
    await migrate(db);
    // The pilot setting keeps its row, terms and revision fence.
    assert.deepEqual(await db.prepare("SELECT * FROM pilot_publication_config").first(), config);
    assert.deepEqual(
      (await db.prepare("SELECT user_id,status,source,decided_by FROM owner_access ORDER BY user_id").all()).results,
      [
        { user_id: "other", status: "approved", source: "backfill", decided_by: null },
        { user_id: "owner", status: "approved", source: "backfill", decided_by: null },
      ],
    );
    assert.deepEqual(
      (await db.prepare("SELECT user_id,action,revision,operator FROM platform_staff_event").all()).results,
      [{ user_id: "guest", action: "grant", revision: 1, operator: "migration-0021" }],
    );
    assert.deepEqual(await capabilities(db, guest), { guest: true, owner: false, admin: true });
    assert.deepEqual(await capabilities(db, owner), { guest: true, owner: true, admin: false });
    assert.equal(await canReview(db, guest), true);
    assert.equal(await canReview(db, owner), false);
    await assert.rejects(capabilities(db, unverified), /verified_session_required/);
  } finally {
    await p.dispose();
  }
});

test("admin grants need a verified account and a matching immutable event; revocation removes review", async () => {
  const p = await database();
  try {
    const db = p.db;
    await catalog(db);
    await configureReviewer(db, "other", "approved-v1");
    assert.equal(await canReview(db, other), true);
    // Unverified accounts cannot be granted; staff rows need their event.
    await assert.rejects(db.batch(grantAdminStatements(db, "unverified")), /invalid_staff_event/);
    await assert.rejects(
      db.prepare("INSERT INTO platform_staff VALUES('guest','admin',1,1)").run(),
      /invalid_staff_change/,
    );
    await assert.rejects(
      db.prepare("UPDATE platform_staff SET active=0 WHERE user_id='other'").run(),
      /invalid_staff_change/,
    );
    // Events are retained and cannot skip a revision.
    await assert.rejects(
      db.prepare("UPDATE platform_staff_event SET reason='changed'").run(),
      /immutable_staff_event/,
    );
    await assert.rejects(db.prepare("DELETE FROM platform_staff_event").run(), /immutable_staff_event/);
    await assert.rejects(
      db.prepare("INSERT INTO platform_staff_event(user_id,action,revision,operator,reason) VALUES('other','revoke',5,'test','Skip')").run(),
      /invalid_staff_event/,
    );
    await assert.rejects(db.prepare("DELETE FROM platform_staff").run(), /invalid_staff_change/);
    await db.batch(grantAdminStatements(db, "other", false));
    assert.equal(await canReview(db, other), false);
    assert.deepEqual(await capabilities(db, other), { guest: true, owner: false, admin: false });
    await db.batch(grantAdminStatements(db, "other"));
    assert.equal(await canReview(db, other), true);
    assert.deepEqual(
      (await db.prepare("SELECT action,revision FROM platform_staff_event WHERE user_id='other' ORDER BY revision").all()).results,
      [
        { action: "grant", revision: 1 },
        { action: "revoke", revision: 2 },
        { action: "grant", revision: 3 },
      ],
    );
    // Losing email verification removes admin without changing the grant.
    await db.prepare("UPDATE user SET emailVerified=0 WHERE id='other'").run();
    await assert.rejects(canReview(db, other), /verified_session_required/);
  } finally {
    await p.dispose();
  }
});
