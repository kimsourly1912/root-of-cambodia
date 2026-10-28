import { test, expect } from "vitest";
import assert from "node:assert/strict";
import { createTestHarness } from "wrangler";
import { catalog, request, scalar } from "./fixtures";
import { historical } from "./historical";

// Load the exact local build output, not an alternate test entrypoint.
const server = createTestHarness({
  workers: [
    {
      configPath: "apps/jobs/wrangler.jsonc",
      prebuiltWorkerDir: "apps/jobs/dist",
    },
  ],
});

test("built jobs Worker handles scheduled expiry and real local queue delivery through shared services", async () => {
  try {
    await server.listen();
    const worker = server.getWorker<JobsEnv>();
    await worker.applyD1Migrations("DB");
    const env = await worker.getEnv(),
      db = env.DB;
    await db
      .prepare(
        "CREATE TABLE local_notification(id TEXT PRIMARY KEY,booking_id TEXT NOT NULL,kind TEXT NOT NULL,recipient TEXT NOT NULL)",
      )
      .run();
    const { input } = await catalog(db);
    const original = await request(db, input);
    const expired = await historical(db, original.id, "unixepoch()-1");
    const results = await Promise.all([
      worker.scheduled({}),
      worker.scheduled({}),
    ]);
    for (const result of results) assert.equal(result.outcome, "ok");
    const expected = await scalar(
      db,
      "SELECT count(*) n FROM notification_outbox",
    );
    await expect
      .poll(
        () =>
          scalar(
            db,
            "SELECT count(*) n FROM notification_outbox WHERE state='delivered'",
          ),
        { timeout: 10_000 },
      )
      .toBe(expected);
    assert.equal(
      await scalar(
        db,
        "SELECT count(*) n FROM booking_event WHERE booking_id=? AND kind='expired'",
        expired,
      ),
      1,
    );
    assert.equal(
      await scalar(db, "SELECT sum(reserved) n FROM inventory_night"),
      0,
    );
    const row = await db
      .prepare("SELECT id FROM notification_outbox LIMIT 1")
      .first<{ id: string }>();
    assert.ok(row);
    const next = await request(db, input);
    const fresh = await db
      .prepare(
        "SELECT id FROM notification_outbox WHERE state='pending' LIMIT 1",
      )
      .first<{ id: string }>();
    assert.ok(fresh);
    await env.NOTIFICATIONS.sendBatch([
      { body: { id: row.id } },
      { body: { id: fresh.id } },
    ]);
    await expect
      .poll(
        () =>
          scalar(
            db,
            "SELECT count(*) n FROM notification_outbox WHERE id=? AND state='delivered'",
            fresh.id,
          ),
        { timeout: 10_000 },
      )
      .toBe(1);
    assert.equal(
      await scalar(db, "SELECT count(*) n FROM local_notification"),
      expected + 1,
    );
    assert.equal(
      await scalar(
        db,
        "SELECT count(*) n FROM delivery_attempt WHERE outbox_id=?",
        row.id,
      ),
      1,
    );
    assert.equal(
      await scalar(
        db,
        "SELECT count(*) n FROM booking WHERE id=? AND status='pending'",
        next.id,
      ),
      1,
    );
    const records = server.getLogs().flatMap((log) => {
      try {
        const value = JSON.parse(log.message);
        return value?.version === 1 ? [value] : [];
      } catch {
        return [];
      }
    });
    assert.ok(
      records.some(
        (r) => r.source === "jobs_queue" && r.code === "provider_accepted",
      ),
    );
    const diagnosticJson = JSON.stringify(records);
    for (const secret of [row.id, original.id, next.id, "@example.invalid"])
      assert.ok(!diagnosticJson.includes(secret));
    for (const record of records.filter((r) => r.source === "jobs_queue"))
      assert.match(record.reference, /^[a-f0-9]{64}$/);
    assert.equal(
      await scalar(db, "SELECT count(*) n FROM booking WHERE status='expired'"),
      1,
    );
  } finally {
    await server.close();
  }
});
