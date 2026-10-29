import { test } from "vitest";
import assert from "node:assert/strict";
import { env } from "cloudflare:workers";
import {
  createExecutionContext,
  createMessageBatch,
  createScheduledController,
  getQueueResult,
} from "cloudflare:test";
import worker from "../apps/jobs/src/index";
import { database, catalog, request, scalar } from "./support";
import { historical } from "./historical";

const jobsEnv = (db: D1Database): JobsEnv => ({
  DB: db,
  APP_MODE: "local",
  NOTIFICATIONS: env.NOTIFICATIONS,
  MEDIA: env.MEDIA,
});
const capture = (db: D1Database) =>
  db
    .prepare(
      "CREATE TABLE local_notification(id TEXT PRIMARY KEY,booking_id TEXT NOT NULL,kind TEXT NOT NULL,recipient TEXT NOT NULL)",
    )
    .run();
const batchFor = (...ids: string[]) =>
  createMessageBatch(
    "roc-notifications-local-only",
    ids.map((id, i) => ({
      id: "message:" + i,
      timestamp: new Date(),
      attempts: 1,
      body: { id },
    })),
  );

test("actual scheduled handler expires once across overlaps and recovers failed publication", async () => {
  const p = await database();
  try {
    const db = p.db,
      { input } = await catalog(db);
    const original = await request(db, input);
    const expired = await historical(db, original.id, "unixepoch()-1");
    const broken = jobsEnv(db);
    broken.NOTIFICATIONS = new Proxy(broken.NOTIFICATIONS, {
      get(target, prop) {
        if (prop === "send")
          return async () => {
            throw new Error(
              "queue_unavailable private@example.invalid token=never-log",
            );
          };
        const value = Reflect.get(target, prop);
        return typeof value === "function" ? value.bind(target) : value;
      },
    });
    await assert.rejects(
      worker.scheduled(createScheduledController(), broken),
      (error) => {
        assert.ok(error instanceof Error);
        assert.equal(error.message, "jobs_maintenance_failed");
        assert.ok(!String(error.stack).includes("private@example.invalid"));
        assert.ok(!("cause" in error));
        return true;
      },
    );
    assert.equal(
      await scalar(
        db,
        "SELECT count(*) n FROM booking_event WHERE booking_id=? AND kind='expired'",
        expired,
      ),
      1,
    );
    const due = (
      await db
        .prepare("SELECT id FROM notification_outbox ORDER BY id")
        .all<{ id: string }>()
    ).results.map((r) => r.id);
    const published: string[] = [];
    const ready = jobsEnv(db);
    ready.NOTIFICATIONS = new Proxy(ready.NOTIFICATIONS, {
      get(target, prop) {
        if (prop === "send")
          return async (body: { id: string }) => {
            published.push(body.id);
          };
        const value = Reflect.get(target, prop);
        return typeof value === "function" ? value.bind(target) : value;
      },
    });
    await Promise.all([
      worker.scheduled(createScheduledController(), ready),
      worker.scheduled(createScheduledController(), ready),
    ]);
    assert.deepEqual([...new Set(published)].sort(), due);
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
  } finally {
    await p.dispose();
  }
});

test("queue handler acknowledges durable backoff, then captures a retry once despite duplicate messages", async () => {
  const p = await database();
  try {
    const db = p.db,
      { input } = await catalog(db);
    await request(db, input);
    const row = await db
      .prepare("SELECT id FROM notification_outbox LIMIT 1")
      .first<{ id: string }>();
    assert.ok(row);
    // Missing local capture table simulates provider failure after claim.
    const failed = batchFor(row.id),
      failedCtx = createExecutionContext();
    await worker.queue(failed, jobsEnv(db));
    assert.deepEqual((await getQueueResult(failed, failedCtx)).explicitAcks, [
      "message:0",
    ]);
    assert.equal(
      await scalar(
        db,
        "SELECT count(*) n FROM delivery_attempt WHERE outcome='retry' AND error_code='provider_retry'",
      ),
      1,
    );
    assert.equal(
      await scalar(
        db,
        "SELECT count(*) n FROM notification_outbox WHERE id=? AND state='pending' AND due_at>unixepoch()",
        row.id,
      ),
      1,
    );
    await capture(db);
    await db
      .prepare("UPDATE notification_outbox SET due_at=0 WHERE id=?")
      .bind(row.id)
      .run();
    const retry = batchFor(row.id, row.id),
      ctx = createExecutionContext();
    await worker.queue(retry, jobsEnv(db));
    const result = await getQueueResult(retry, ctx);
    assert.deepEqual(result.explicitAcks, ["message:0", "message:1"]);
    assert.equal(result.retryMessages.length, 0);
    assert.equal(
      await scalar(db, "SELECT count(*) n FROM local_notification"),
      1,
    );
    assert.equal(
      await scalar(
        db,
        "SELECT count(*) n FROM delivery_attempt WHERE outcome='delivered'",
      ),
      1,
    );
  } finally {
    await p.dispose();
  }
});

test("queue handler retries an uncertain database acknowledgement using the same provider key", async () => {
  const p = await database();
  try {
    const db = p.db,
      { input } = await catalog(db);
    await request(db, input);
    await capture(db);
    const row = await db
      .prepare("SELECT id FROM notification_outbox LIMIT 1")
      .first<{ id: string }>();
    assert.ok(row);
    let batches = 0;
    const ambiguous = new Proxy(db, {
      get(target, prop) {
        if (prop === "batch")
          return async (...args: Parameters<D1Database["batch"]>) => {
            if (++batches === 2)
              throw new Error("lost_database_acknowledgement");
            return target.batch(...args);
          };
        const value = Reflect.get(target, prop);
        return typeof value === "function" ? value.bind(target) : value;
      },
    });
    const batch = batchFor(row.id),
      ctx = createExecutionContext();
    await worker.queue(batch, jobsEnv(ambiguous));
    const result = await getQueueResult(batch, ctx);
    assert.deepEqual(
      result.retryMessages.map((m) => m.msgId),
      ["message:0"],
    );
    assert.equal(result.explicitAcks.length, 0);
    assert.equal(
      await scalar(db, "SELECT count(*) n FROM local_notification"),
      1,
    );
    await db
      .prepare("UPDATE notification_outbox SET lease_until=0 WHERE id=?")
      .bind(row.id)
      .run();
    await worker.queue(batchFor(row.id), jobsEnv(db));
    assert.equal(
      await scalar(db, "SELECT count(*) n FROM local_notification"),
      1,
    );
    assert.equal(
      await scalar(
        db,
        "SELECT count(*) n FROM notification_outbox WHERE id=? AND state='delivered'",
        row.id,
      ),
      1,
    );
  } finally {
    await p.dispose();
  }
});

test("jobs reject unconfigured nonlocal runtime before side effects or acknowledgements", async () => {
  const p = await database();
  try {
    const disabled = jobsEnv(p.db);
    Reflect.set(disabled, "APP_MODE", "production");
    await assert.rejects(
      worker.scheduled(createScheduledController(), disabled),
      /not configured/,
    );
    const batch = batchFor("opaque-id"),
      ctx = createExecutionContext();
    await assert.rejects(worker.queue(batch, disabled), /not configured/);
    assert.equal((await getQueueResult(batch, ctx)).explicitAcks.length, 0);
    assert.equal(await scalar(p.db, "SELECT count(*) n FROM operation"), 0);
  } finally {
    await p.dispose();
  }
});
