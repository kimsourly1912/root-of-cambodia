import { test } from "vitest";
import assert from "node:assert/strict";
import { database, catalog, request, scalar } from "../../testing/support";
import { deliver } from "@root-of-cambodia/backend/shared";

async function pendingNotification(db: D1Database) {
  const { input } = await catalog(db);
  await request(db, input);
  const row = await db
    .prepare("SELECT id,recipient_id FROM notification_outbox LIMIT 1")
    .first<{ id: string; recipient_id: string }>();
  assert.ok(row);
  return row;
}
function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason: Error) => void;
  const promise = new Promise<T>((yes, no) => {
    resolve = yes;
    reject = no;
  });
  return { promise, resolve, reject };
}
const state = (db: D1Database, id: string) =>
  db
    .prepare(
      "SELECT state,lease_token,lease_until,attempts,due_at,delivered_at,provider_id FROM notification_outbox WHERE id=?",
    )
    .bind(id)
    .first();

test("a stale successful worker records its attempt but cannot report completion or overwrite the newer acknowledgement", async () => {
  const p = await database();
  try {
    const db = p.db,
      row = await pendingNotification(db);
    const entered = deferred<void>(),
      response = deferred<{ id: string }>();
    const keys: string[] = [];
    const old = deliver(db, row.id, {
      send: async (_message, options) => {
        keys.push(options.idempotencyKey);
        entered.resolve();
        return response.promise;
      },
    });
    await entered.promise;
    await db
      .prepare("UPDATE notification_outbox SET lease_until=0 WHERE id=?")
      .bind(row.id)
      .run();
    const winner = await deliver(db, row.id, {
      send: async (_message, options) => {
        keys.push(options.idempotencyKey);
        return { id: "new-provider-acceptance" };
      },
    });
    assert.equal(winner.outcome, "provider_accepted");
    assert.equal(winner.inboxDelivery, "unknown");
    const committed = await state(db, row.id);
    response.resolve({ id: "old-provider-acceptance" });
    const stale = await old;
    assert.equal(stale.outcome, "lease_superseded");
    assert.equal(stale.providerAccepted, true);
    assert.equal(stale.delivered, false);
    assert.equal(stale.inboxDelivery, "unknown");
    assert.deepEqual(await state(db, row.id), committed);
    assert.deepEqual(keys, [row.id, row.id]);
    assert.equal(
      await scalar(
        db,
        "SELECT count(*) n FROM delivery_attempt WHERE outbox_id=? AND outcome='delivered'",
        row.id,
      ),
      2,
    );
  } finally {
    await p.dispose();
  }
});

test("a stale provider failure cannot reschedule or clear a newer worker's active lease", async () => {
  const p = await database();
  try {
    const db = p.db,
      row = await pendingNotification(db);
    const entered = deferred<void>(),
      response = deferred<{ id: string }>();
    const old = deliver(db, row.id, {
      send: async () => {
        entered.resolve();
        return response.promise;
      },
    });
    await entered.promise;
    await db
      .prepare("UPDATE notification_outbox SET lease_until=0 WHERE id=?")
      .bind(row.id)
      .run();
    const winner = await deliver(db, row.id, {
      send: async () => {
        const leased = await state(db, row.id);
        assert.equal(leased?.state, "sending");
        response.reject(
          new Error("private-provider-error@example.invalid token=never-log"),
        );
        const stale = await old;
        assert.equal(stale.outcome, "lease_superseded");
        assert.equal(stale.providerAccepted, false);
        assert.equal(stale.delivered, false);
        assert.deepEqual(await state(db, row.id), leased);
        return { id: "winning-acceptance" };
      },
    });
    assert.equal(winner.outcome, "provider_accepted");
    assert.equal((await state(db, row.id))?.provider_id, "winning-acceptance");
    assert.equal(
      await scalar(
        db,
        "SELECT count(*) n FROM delivery_attempt WHERE outbox_id=? AND error_code='provider_retry'",
        row.id,
      ),
      1,
    );
  } finally {
    await p.dispose();
  }
});

test("an unavailable verified recipient stays recoverable and acceptance never claims inbox delivery", async () => {
  const p = await database();
  try {
    const db = p.db,
      row = await pendingNotification(db);
    await db
      .prepare("UPDATE user SET emailVerified=0 WHERE id=?")
      .bind(row.recipient_id)
      .run();
    let calls = 0;
    const provider = {
      send: async () => {
        calls++;
        return { id: "accepted" };
      },
    };
    const failed = await deliver(db, row.id, provider);
    assert.equal(calls, 0);
    assert.equal(failed.outcome, "retry_scheduled");
    assert.equal(failed.providerAccepted, false);
    assert.equal(failed.inboxDelivery, "unknown");
    assert.equal(
      await scalar(
        db,
        "SELECT count(*) n FROM delivery_attempt WHERE error_code='recipient_unavailable'",
      ),
      1,
    );
    await db
      .prepare("UPDATE user SET emailVerified=1 WHERE id=?")
      .bind(row.recipient_id)
      .run();
    await db
      .prepare("UPDATE notification_outbox SET due_at=0 WHERE id=?")
      .bind(row.id)
      .run();
    const accepted = await deliver(db, row.id, provider);
    assert.equal(accepted.outcome, "provider_accepted");
    assert.equal(accepted.providerAccepted, true);
    assert.equal(accepted.delivered, true); // Historical field means provider acceptance only.
    assert.equal(accepted.inboxDelivery, "unknown");
    assert.equal(calls, 1);
    const duplicate = await deliver(db, row.id, provider);
    assert.equal(duplicate.outcome, "not_claimed");
    assert.equal(duplicate.providerAccepted, false); // This invocation did not call a provider.
    assert.equal(duplicate.inboxDelivery, "unknown");
    assert.equal(calls, 1);
  } finally {
    await p.dispose();
  }
});
