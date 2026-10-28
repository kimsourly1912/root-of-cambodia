import { test } from "node:test";
import assert from "node:assert/strict";
import {
  database,
  catalog,
  request,
  scalar,
  guest,
  owner,
  other,
  unverified,
} from "./support";
import { quote, dates, localInstant } from "../src/quotes";
import { submit, transition, expireDue } from "../src/bookings";
import { editInventory } from "../src/inventory";
import { readBooking } from "../src/access";
import { deliver, publishDue } from "../src/outbox";
const conflict = (e: unknown) =>
  e instanceof Error && /conflict|unavailable|quote_changed/.test(e.message);
async function scenario(
  run: (
    db: D1Database,
    fixture: Awaited<ReturnType<typeof catalog>>,
  ) => Promise<void>,
  capacity = 2,
) {
  const p = await database();
  try {
    await run(p.db, await catalog(p.db, capacity));
  } finally {
    await p.dispose();
  }
}
test("multi-room submission snapshots authoritative prices, occupancy, terms and complete checkout-exclusive nights", () =>
  scenario(async (db, { input }) => {
    input.lines.push({ roomId: "r2", quantity: 2, adults: 3, children: 1 });
    const receipt = await request(db, input),
      view = await readBooking(db, guest, receipt.id);
    assert.equal(view.status, "pending");
    assert.equal(view.totalCents, 21500);
    assert.equal(view.lines.length, 4);
    assert.equal(view.expiresAt - view.submittedAt, 43200);
    assert.equal(view.timezone, "Asia/Phnom_Penh");
    assert.equal(
      await scalar(db, "SELECT sum(reserved) n FROM inventory_night"),
      0,
    );
    assert.equal(
      await scalar(
        db,
        "SELECT count(*) n FROM booking_night WHERE night=?",
        input.checkout,
      ),
      0,
    );
    await db.prepare("UPDATE nightly_rate SET unit_cents=1").run();
    await db
      .prepare("UPDATE property SET policy_text='Changed',checkin_time='15:00'")
      .run();
    await db.prepare("UPDATE room_type SET name='Changed'").run();
    assert.equal((await readBooking(db, guest, receipt.id)).totalCents, 21500);
    assert.equal(
      (await readBooking(db, guest, receipt.id)).policyText,
      "Property rules at submission.",
    );
    await transition(db, owner, "accept", receipt.id, "accept");
    assert.equal(
      await scalar(db, "SELECT sum(reserved) n FROM inventory_night"),
      6,
    );
  }));
test("invalid calendar dates, duplicate room types and occupancy overflow rejected", () =>
  scenario(async (db, { input }) => {
    assert.throws(() => dates("2027-02-29", "2027-03-02"));
    assert.throws(() => dates(input.checkout, input.checkin));
    assert.equal(
      localInstant("2026-10-29", "00:00"),
      Date.parse("2026-10-28T17:00:00Z") / 1000,
    );
    await assert.rejects(
      quote(db, guest, { ...input, lines: [...input.lines, ...input.lines] }),
    );
    await assert.rejects(
      quote(db, guest, {
        ...input,
        lines: [{ ...input.lines[0], quantity: 1.5 }],
      }),
    );
    await assert.rejects(
      quote(db, guest, {
        ...input,
        lines: [{ ...input.lines[0], children: 2 }],
      }),
    );
  }));
test("missing rates or calendar nights and foreign property room cannot form a request", () =>
  scenario(async (db, { input }) => {
    await db
      .prepare("DELETE FROM nightly_rate WHERE room_type_id=? AND night=?")
      .bind("r", input.checkin)
      .run();
    await assert.rejects(quote(db, guest, input));
    await assert.rejects(
      quote(db, guest, {
        ...input,
        lines: [{ ...input.lines[0], roomId: "other-r" }],
      }),
    );
    await db
      .prepare("DELETE FROM inventory_night WHERE room_type_id=? AND night=?")
      .bind("r2", input.checkin)
      .run();
    await assert.rejects(
      quote(db, guest, {
        ...input,
        lines: [{ ...input.lines[0], roomId: "r2" }],
      }),
    );
  }));
test("changed quote and paused property rejected; existing requests remain operable", () =>
  scenario(async (db, { input }) => {
    const old = await quote(db, guest, input);
    await db
      .prepare("UPDATE nightly_rate SET unit_cents=4000 WHERE room_type_id='r'")
      .run();
    await assert.rejects(submit(db, guest, "old", input, old.hash), conflict);
    const r = await request(db, input);
    await db
      .prepare("UPDATE place SET publication='paused' WHERE id='p'")
      .run();
    await assert.rejects(quote(db, guest, input));
    await transition(db, owner, "accept", r.id, "accept");
  }));
test("last room acceptance race allocates all nights once; loser has no confirmation effects", () =>
  scenario(async (db, { input }) => {
    const [a, b] = await Promise.all([request(db, input), request(db, input)]);
    const results = await Promise.allSettled([
      transition(db, owner, "a", a.id, "accept"),
      transition(db, owner, "b", b.id, "accept"),
    ]);
    assert.equal(results.filter((r) => r.status === "fulfilled").length, 1);
    assert.equal(
      await scalar(db, "SELECT sum(reserved) n FROM inventory_night"),
      2,
    );
    assert.equal(
      await scalar(
        db,
        "SELECT count(*) n FROM booking_event WHERE kind='confirmed'",
      ),
      1,
    );
    assert.equal(
      await scalar(
        db,
        "SELECT count(*) n FROM notification_outbox o JOIN booking_event e ON e.id=o.event_id WHERE e.kind='confirmed'",
      ),
      2,
    );
  }, 1));
test("last-night shortage rolls back earlier allocations, events, outbox and receipt", () =>
  scenario(async (db, { input, days }) => {
    const r = await request(db, input);
    await editInventory(db, owner, "block", {
      roomId: "r",
      night: days[1],
      capacity: 2,
      blocked: 2,
      revision: 1,
    });
    await assert.rejects(
      transition(db, owner, "accept", r.id, "accept"),
      conflict,
    );
    assert.equal(
      await scalar(db, "SELECT sum(reserved) n FROM inventory_night"),
      0,
    );
    assert.equal(
      await scalar(
        db,
        "SELECT count(*) n FROM booking_event WHERE kind='confirmed'",
      ),
      0,
    );
    assert.equal(
      await scalar(db, "SELECT count(*) n FROM operation WHERE key='accept'"),
      0,
    );
  }));
test("external reservation races online acceptance through the same invariant", () =>
  scenario(async (db, { input }) => {
    const pending = await request(db, input),
      external = await quote(db, owner, input, "external");
    const results = await Promise.allSettled([
      transition(db, owner, "online", pending.id, "accept"),
      submit(db, owner, "external", input, external.hash, "external"),
    ]);
    assert.equal(results.filter((r) => r.status === "fulfilled").length, 1);
    assert.equal(
      await scalar(db, "SELECT sum(reserved) n FROM inventory_night"),
      2,
    );
  }, 1));
test("versioned blocks and capacity reductions never displace committed inventory", () =>
  scenario(async (db, { input, days }) => {
    const r = await request(db, input);
    await transition(db, owner, "accept", r.id, "accept");
    await assert.rejects(
      editInventory(db, owner, "capacity", {
        roomId: "r",
        night: days[0],
        capacity: 0,
        blocked: 0,
        revision: 1,
      }),
      conflict,
    );
    await assert.rejects(
      editInventory(db, owner, "block", {
        roomId: "r",
        night: days[0],
        capacity: 2,
        blocked: 2,
        revision: 1,
      }),
      conflict,
    );
    await editInventory(db, owner, "valid", {
      roomId: "r",
      night: days[0],
      capacity: 3,
      blocked: 1,
      revision: 1,
    });
    await assert.rejects(
      editInventory(db, owner, "stale", {
        roomId: "r",
        night: days[0],
        capacity: 3,
        blocked: 0,
        revision: 1,
      }),
      conflict,
    );
  }));
test("cancellation releases once, requires owner reason and preserves attributable immutable history", () =>
  scenario(async (db, { input }) => {
    const r = await request(db, input);
    await transition(db, owner, "accept", r.id, "accept");
    await assert.rejects(
      transition(db, owner, "no-reason", r.id, "cancel_owner"),
    );
    const first = await transition(
      db,
      owner,
      "cancel",
      r.id,
      "cancel_owner",
      "Maintenance",
    );
    assert.deepEqual(
      await transition(
        db,
        owner,
        "cancel",
        r.id,
        "cancel_owner",
        "Maintenance",
      ),
      first,
    );
    assert.equal(
      await scalar(db, "SELECT sum(reserved) n FROM inventory_night"),
      0,
    );
    assert.equal(
      await scalar(
        db,
        "SELECT sum(released) n FROM allocation WHERE booking_id=?",
        r.id,
      ),
      2,
    );
    await assert.rejects(
      db.prepare("UPDATE booking_event SET reason='Changed'").run(),
    );
    await assert.rejects(transition(db, owner, "reopen", r.id, "accept"));
  }));
test("pending decline and guest cancellation never add stock; completion and arrival fail closed", () =>
  scenario(async (db, { input }) => {
    const a = await request(db, input),
      b = await request(db, input);
    await transition(db, owner, "decline", a.id, "decline");
    await transition(db, guest, "cancel", b.id, "cancel_guest");
    assert.equal(
      await scalar(db, "SELECT sum(reserved) n FROM inventory_night"),
      0,
    );
    await assert.rejects(
      transition(db, owner, "arrival", b.id, "check_in"),
      /arrival_policy/,
    );
    await assert.rejects(transition(db, owner, "complete", a.id, "complete"));
  }));
test("verified guest and owner access is property-scoped; no implicit admin bypass", () =>
  scenario(async (db, { input, days }) => {
    const r = await request(db, input);
    await readBooking(db, owner, r.id);
    await assert.rejects(readBooking(db, other, r.id), /not_found/);
    await assert.rejects(readBooking(db, unverified, r.id), /verified/);
    await assert.rejects(
      transition(db, guest, "accept", r.id, "accept"),
      /not_found/,
    );
    await assert.rejects(
      transition(db, other, "accept", r.id, "accept"),
      /not_found/,
    );
    await assert.rejects(
      editInventory(db, other, "block", {
        roomId: "r",
        night: days[0],
        capacity: 1,
        blocked: 1,
        revision: 1,
      }),
      /not_found/,
    );
    await db.prepare("UPDATE user SET emailVerified=0 WHERE id='owner'").run();
    await assert.rejects(
      transition(db, owner, "revoked", r.id, "accept"),
      /verified/,
    );
  }));
test("same scoped idempotency key returns original submission after prices change, conflict on changed payload", () =>
  scenario(async (db, { input }) => {
    const q = await quote(db, guest, input);
    const results = await Promise.all([
      submit(db, guest, "same", input, q.hash),
      submit(db, guest, "same", input, q.hash),
    ]);
    assert.deepEqual(results[0], results[1]);
    await db.prepare("UPDATE nightly_rate SET unit_cents=9999").run();
    assert.deepEqual(
      await submit(db, guest, "same", input, q.hash),
      results[0],
    );
    await assert.rejects(
      submit(
        db,
        guest,
        "same",
        { ...input, lines: [{ ...input.lines[0], adults: 1 }] },
        q.hash,
      ),
      /idempotency_conflict/,
    );
    assert.equal(await scalar(db, "SELECT count(*) n FROM booking"), 1);
  }));
test("ambiguous commit timeout recovers the durable receipt instead of allocating twice", () =>
  scenario(async (db, { input }) => {
    const r = await request(db, input);
    let lost = true;
    const ambiguous = new Proxy(db, {
      get(target, prop) {
        if (prop === "batch")
          return async (...args: Parameters<D1Database["batch"]>) => {
            const result = await target.batch(...args);
            if (lost) {
              lost = false;
              throw new Error("simulated_response_timeout");
            }
            return result;
          };
        const value = Reflect.get(target, prop);
        return typeof value === "function" ? value.bind(target) : value;
      },
    });
    const receipt = await transition(
      ambiguous,
      owner,
      "accept",
      r.id,
      "accept",
    );
    assert.equal(receipt.status, "confirmed");
    assert.deepEqual(
      await transition(db, owner, "accept", r.id, "accept"),
      receipt,
    );
    assert.equal(
      await scalar(db, "SELECT sum(reserved) n FROM inventory_night"),
      2,
    );
  }));
test("submitted lines, prices, occupancy, policy and property relationships cannot be rewritten or deleted", () =>
  scenario(async (db, { input }) => {
    const r = await request(db, input);
    for (const sql of [
      "UPDATE booking SET total_cents=1",
      "UPDATE booking SET policy_text='changed'",
      "UPDATE booking_line SET adults=1",
      "DELETE FROM booking_night",
      "INSERT INTO booking_charge SELECT id,'extra','Extra',1 FROM booking",
      "DELETE FROM booking",
      "DELETE FROM property WHERE id='p'",
      "DELETE FROM user WHERE id='guest'",
    ])
      await assert.rejects(db.prepare(sql).run(), sql);
    assert.equal((await readBooking(db, guest, r.id)).totalCents, 7500);
  }));
test("outbox retries provider failure, ignores duplicate delivery, and sweeps missed publication", () =>
  scenario(async (db, { input }) => {
    await request(db, input);
    let publications: string[] = [];
    await assert.rejects(
      publishDue(db, {
        send: async () => {
          throw new Error("queue timeout");
        },
      }),
    );
    await publishDue(db, {
      send: async (m) => {
        publications.push(m.id);
      },
    });
    assert.equal(publications.length, 2);
    let calls = 0;
    const id = publications[0];
    const failed = await deliver(db, id, {
      send: async () => {
        calls++;
        throw new Error("provider failure");
      },
    });
    assert.equal(failed.delivered, false);
    assert.equal(
      (
        await deliver(db, id, {
          send: async () => {
            throw new Error("must wait for backoff");
          },
        })
      ).claimed,
      false,
    );
    await db
      .prepare("UPDATE notification_outbox SET due_at=0 WHERE id=?")
      .bind(id)
      .run();
    const sent = await Promise.all([
      deliver(db, id, {
        send: async (m, o) => {
          calls++;
          assert.equal(o.idempotencyKey, id);
          return { id: "provider-1" };
        },
      }),
      deliver(db, id, {
        send: async () => {
          calls++;
          return { id: "duplicate" };
        },
      }),
    ]);
    assert.equal(sent.filter((s) => s.claimed).length, 1);
    assert.equal(calls, 2);
    assert.equal(
      (
        await deliver(db, id, {
          send: async () => {
            throw new Error("duplicate");
          },
        })
      ).claimed,
      false,
    );
    assert.equal(
      await scalar(
        db,
        "SELECT count(*) n FROM delivery_attempt WHERE outbox_id=?",
        id,
      ),
      2,
    );
  }));
test("expired delivery lease recovers process death with stable provider key", () =>
  scenario(async (db, { input }) => {
    await request(db, input);
    const row = await db
      .prepare("SELECT id FROM notification_outbox LIMIT 1")
      .first<{ id: string }>();
    assert.ok(row);
    await db
      .prepare(
        "UPDATE notification_outbox SET state='sending',lease_token='dead',lease_until=0 WHERE id=?",
      )
      .bind(row.id)
      .run();
    let ids: string[] = [];
    await publishDue(db, {
      send: async (m) => {
        ids.push(m.id);
      },
    });
    assert.ok(ids.includes(row.id));
    assert.equal(
      (
        await deliver(db, row.id, {
          send: async (m, o) => {
            assert.equal(o.idempotencyKey, row.id);
            return { id: "recovered" };
          },
        })
      ).delivered,
      true,
    );
  }));

test("blocking races acceptance without oversell and cancellation races acceptance without leaked stock", () =>
  scenario(async (db, { input, days }) => {
    const r = await request(db, input);
    const results = await Promise.allSettled([
      transition(db, owner, "accept", r.id, "accept"),
      editInventory(db, owner, "block", {
        roomId: "r",
        night: days[0],
        capacity: 1,
        blocked: 1,
        revision: 1,
      }),
    ]);
    assert.equal(results.filter((r) => r.status === "fulfilled").length, 1);
    const remaining = await db
      .prepare(
        "SELECT capacity,blocked,reserved FROM inventory_night WHERE room_type_id=? AND night=?",
      )
      .bind("r", days[0])
      .first<{ capacity: number; blocked: number; reserved: number }>();
    assert.ok(remaining);
    assert.ok(remaining.reserved + remaining.blocked <= remaining.capacity);
    if (remaining.reserved)
      await transition(
        db,
        owner,
        "cancel-first",
        r.id,
        "cancel_owner",
        "Test fixture release",
      );
    if (remaining.blocked)
      await editInventory(db, owner, "unblock", {
        roomId: "r",
        night: days[0],
        capacity: 1,
        blocked: 0,
        revision: 2,
      });
    const next = await request(db, input);
    await Promise.allSettled([
      transition(db, owner, "accept-next", next.id, "accept"),
      transition(db, guest, "cancel-next", next.id, "cancel_guest"),
    ]);
    assert.equal((await readBooking(db, guest, next.id)).status, "cancelled");
    // The first request may hold stock; the cancelled request never does.
    assert.equal(
      await scalar(
        db,
        "SELECT count(*) n FROM allocation WHERE booking_id=? AND released=0",
        next.id,
      ),
      0,
    );
  }, 1));
test("completion from an existing checked-in fixture retains occupied-night allocations and history", () =>
  scenario(async (db, { input }) => {
    const r = await request(db, input);
    await transition(db, owner, "accept", r.id, "accept");
    // Trusted import fixture only: the arrival endpoint remains blocked on policy.
    const op = crypto.randomUUID();
    await db.batch([
      db
        .prepare(
          "INSERT INTO operation(id,principal,actor_id,key,fingerprint,kind,actor_role) VALUES (?,'user:owner','owner',?,'import-fixture','checked_in_import','owner')",
        )
        .bind(op, op),
      db
        .prepare(
          "UPDATE booking SET status='checked_in',last_operation_id=? WHERE id=?",
        )
        .bind(op, r.id),
    ]);
    const completed = await transition(db, owner, "complete", r.id, "complete");
    assert.equal(completed.status, "completed");
    assert.deepEqual(
      await transition(db, owner, "complete", r.id, "complete"),
      completed,
    );
    assert.equal(
      await scalar(db, "SELECT sum(reserved) n FROM inventory_night"),
      2,
    );
    assert.equal(
      await scalar(db, "SELECT count(*) n FROM allocation WHERE released=0"),
      2,
    );
    const event = await db
      .prepare(
        "SELECT actor_id,actor_role FROM booking_event WHERE booking_id=? AND kind='completed'",
      )
      .bind(r.id)
      .first();
    assert.deepEqual(event, { actor_id: "owner", actor_role: "owner" });
  }));
test("notification success followed by lost database acknowledgement recovers with the same provider key", () =>
  scenario(async (db, { input }) => {
    await request(db, input);
    const row = await db
      .prepare("SELECT id FROM notification_outbox LIMIT 1")
      .first<{ id: string }>();
    assert.ok(row);
    let batches = 0;
    const ambiguous = new Proxy(db, {
      get(target, prop) {
        if (prop === "batch")
          return async (...args: Parameters<D1Database["batch"]>) => {
            batches++;
            if (batches === 2)
              throw new Error("database_unavailable_before_ack");
            return target.batch(...args);
          };
        const v = Reflect.get(target, prop);
        return typeof v === "function" ? v.bind(target) : v;
      },
    });
    const keys: string[] = [];
    const provider = {
      send: async (_m: unknown, o: { idempotencyKey: string }) => {
        keys.push(o.idempotencyKey);
        return { id: "same-provider-message" };
      },
    };
    await assert.rejects(
      deliver(ambiguous, row.id, provider),
      /database_unavailable/,
    );
    await db
      .prepare("UPDATE notification_outbox SET lease_until=0 WHERE id=?")
      .bind(row.id)
      .run();
    assert.equal((await deliver(db, row.id, provider)).delivered, true);
    assert.deepEqual(keys, [row.id, row.id]);
  }));
