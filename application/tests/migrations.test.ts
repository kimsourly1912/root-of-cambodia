import { env } from "cloudflare:workers";
import { test } from "vitest";
import assert from "node:assert/strict";
import { getMigrations } from "better-auth/db/migration";
import { database, migrate, catalog, request, owner, scalar } from "./support";
import { transition } from "../src/bookings";
import { deliver } from "../src/outbox";
import { makeAuth } from "../src/auth";
test("fresh installation has all FKs/indexes and matches the pinned Better Auth configuration", async () => {
  const p = await database({ migrate: false });
  try {
    const db = p.db;
    await migrate(db);
    const applied = await db
      .prepare("SELECT name FROM d1_migrations ORDER BY name")
      .all<{ name: string }>();
    assert.deepEqual(
      applied.results.map((row) => row.name),
      env.TEST_MIGRATIONS.map((migration) => migration.name).sort(),
    );
    await migrate(db);
    assert.equal(
      await scalar(db, "SELECT count(*) n FROM d1_migrations"),
      env.TEST_MIGRATIONS.length,
    );
    const schema = await getMigrations(
      makeAuth(db, {
        secret: "local-test-secret-with-more-than-32-characters",
        baseURL: "http://127.0.0.1:8787",
        mailer: { send: async () => {} },
      }).options,
    );
    assert.equal(schema.toBeCreated.length, 0);
    assert.equal(schema.toBeAdded.length, 0);
    assert.equal(schema.toBeAddedIndexes.length, 0);
    assert.deepEqual(
      (await db.prepare("PRAGMA foreign_key_check").all()).results,
      [],
    );
    const indexes = await db
      .prepare("SELECT name FROM sqlite_master WHERE type='index'")
      .all<{ name: string }>();
    for (const name of [
      "property_owner",
      "room_property",
      "booking_guest",
      "booking_property",
      "booking_expiry",
      "outbox_due",
      "outbox_expired_lease",
      "allocation_booking",
    ])
      assert.ok(indexes.results.some((i) => i.name === name));
    const { input } = await catalog(db);
    const r = await request(db, input);
    await transition(db, owner, "accept", r.id, "accept");
    assert.deepEqual(
      (await db.prepare("PRAGMA foreign_key_check").all()).results,
      [],
    );
  } finally {
    await p.dispose();
  }
});
test("populated identity/catalog upgrade and populated booking/outbox upgrade preserve history and pending work", async () => {
  const p = await database({ migrate: false });
  try {
    const db = p.db;
    await migrate(db, ["0001_identity_catalog.sql"]);
    const { input } = await catalog(db);
    await db
      .prepare(
        "INSERT INTO session(id,expiresAt,token,createdAt,updatedAt,userId) VALUES('s',9999999999999,'private-fixture-token',1,1,'guest')",
      )
      .run();
    await migrate(db, ["0002_booking_operations.sql"]);
    const r = await request(db, input);
    await transition(db, owner, "accept", r.id, "accept");
    await db
      .prepare(
        "INSERT INTO delivery_attempt(outbox_id,attempt,token,outcome) SELECT id,1,'old-attempt','started' FROM notification_outbox LIMIT 1",
      )
      .run();
    const counts = await db
      .prepare(
        "SELECT (SELECT count(*) FROM booking) b,(SELECT count(*) FROM booking_event) e,(SELECT sum(reserved) FROM inventory_night) r,(SELECT count(*) FROM notification_outbox) o",
      )
      .first();
    await migrate(db, ["0003_delivery_recovery.sql"]);
    assert.deepEqual(
      await db
        .prepare(
          "SELECT (SELECT count(*) FROM booking) b,(SELECT count(*) FROM booking_event) e,(SELECT sum(reserved) FROM inventory_night) r,(SELECT count(*) FROM notification_outbox) o",
        )
        .first(),
      counts,
    );
    assert.equal(
      await scalar(db, "SELECT count(*) n FROM session WHERE id='s'"),
      1,
    );
    assert.equal(
      await scalar(
        db,
        "SELECT count(*) n FROM delivery_attempt WHERE error_code IS NULL",
      ),
      1,
    );
    const row = await db
      .prepare(
        "SELECT id FROM notification_outbox WHERE id NOT IN(SELECT outbox_id FROM delivery_attempt) LIMIT 1",
      )
      .first<{ id: string }>();
    assert.ok(row);
    assert.equal(
      (await deliver(db, row.id, { send: async () => ({ id: "upgrade-ok" }) }))
        .delivered,
      true,
    );
    assert.deepEqual(
      (await db.prepare("PRAGMA foreign_key_check").all()).results,
      [],
    );
  } finally {
    await p.dispose();
  }
});
