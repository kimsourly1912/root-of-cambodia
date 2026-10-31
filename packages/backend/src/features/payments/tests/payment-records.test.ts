import { test } from "vitest";
import assert from "node:assert/strict";
import { env } from "cloudflare:workers";
import {
  database,
  catalog,
  request,
  guest,
  owner,
  other,
  unverified,
  scalar,
  migrate,
} from "../../../testing/support";
import { testTransition } from "../../../testing/booking-fixtures";
import { atScheduledArrival } from "../../../testing/stay-fixtures";
import { transition } from "@root-of-cambodia/backend/bookings";
import {
  changePayment,
  preparePayment,
  applyPayment,
  paymentAttempt,
  paymentInput,
} from "@root-of-cambodia/backend/payments";
import { ownerPayments } from "@root-of-cambodia/backend/payments";
import { guestBooking } from "@root-of-cambodia/backend/bookings";
async function ready(db: D1Database) {
  const { input } = await catalog(db);
  const r = await request(db, input);
  await testTransition(db, owner, "accept", r.id, "accept");
  await atScheduledArrival(db, r.id);
  await transition(db, owner, "arrived", r.id, "check_in");
  return r;
}
test("payment is a full owner attestation, retains immutable correction history and never changes booking or stock", async () => {
  const p = await database();
  try {
    const db = p.db,
      r = await ready(db),
      before = await guestBooking(db, guest, r.id),
      stock = await scalar(db, "SELECT sum(reserved) n FROM inventory_night");
    assert.equal((await ownerPayments(db, owner, r.id)).status, "not_recorded");
    const a = await changePayment(db, owner, "paid", r.id, {
      action: "record",
      revision: 0,
    });
    assert.equal(a.status, "recorded");
    let g = await guestBooking(db, guest, r.id);
    assert.equal(g.payment.status, "recorded");
    assert.equal(g.payment.amountCents, before.totalCents);
    assert.deepEqual(Object.keys(g.payment).sort(), [
      "amountCents",
      "changedAt",
      "recordedAt",
      "status",
    ]);
    assert.equal(g.status, before.status);
    assert.equal(g.totalCents, before.totalCents);
    assert.deepEqual(g.lines, before.lines);
    await assert.rejects(
      changePayment(db, owner, "twice", r.id, {
        action: "record",
        revision: 1,
      }),
      /booking_conflict/,
    );
    await assert.rejects(
      changePayment(db, owner, "blank", r.id, {
        action: "void",
        revision: 1,
        reason: " ",
      }),
      /invalid_payment/,
    );
    await changePayment(db, owner, "void", r.id, {
      action: "void",
      revision: 1,
      reason: "PRIVATE_CORRECTION_REASON",
    });
    g = await guestBooking(db, guest, r.id);
    assert.equal(g.payment.status, "not_recorded");
    assert.ok(!JSON.stringify(g).includes("PRIVATE_CORRECTION_REASON"));
    assert.deepEqual(
      await changePayment(db, owner, "paid", r.id, {
        action: "record",
        revision: 0,
      }),
      a,
    );
    const events = (await ownerPayments(db, owner, r.id)).events;
    assert.equal(events.length, 2);
    assert.equal(events[0].reason, "PRIVATE_CORRECTION_REASON");
    await changePayment(db, owner, "replace", r.id, {
      action: "record",
      revision: 2,
    });
    assert.equal((await ownerPayments(db, owner, r.id)).revision, 3);
    assert.equal(
      await scalar(db, "SELECT sum(reserved) n FROM inventory_night"),
      stock,
    );
    assert.equal(
      await scalar(
        db,
        "SELECT count(*) n FROM booking_event WHERE booking_id=? AND kind='checked_in'",
        r.id,
      ),
      1,
    );
    await transition(db, owner, "completed", r.id, "complete");
    assert.equal(
      (await guestBooking(db, guest, r.id)).payment.status,
      "recorded",
    );
    await assert.rejects(
      db.prepare("UPDATE booking_payment_event SET reason='change'").run(),
      /immutable_payment/,
    );
    await assert.rejects(
      db.prepare("DELETE FROM booking_payment_state").run(),
      /retained_payment/,
    );
  } finally {
    await p.dispose();
  }
});
test("same-key races, stale revisions, safe prepared review recovery and revoked access", async () => {
  const p = await database();
  try {
    const db = p.db,
      r = await ready(db),
      id = crypto.randomUUID();
    await preparePayment(db, owner, r.id, id, {
      action: "record",
      revision: 0,
    });
    await assert.rejects(paymentAttempt(db, other, r.id, id), /not_found/);
    await assert.rejects(
      preparePayment(db, owner, r.id, id, { action: "record", revision: 1 }),
      /idempotency_conflict/,
    );
    const [a, b] = await Promise.all([
      applyPayment(db, owner, r.id, id),
      applyPayment(db, owner, r.id, id),
    ]);
    assert.deepEqual(a, b);
    assert.equal(
      await scalar(db, "SELECT count(*) n FROM booking_payment_event"),
      1,
    );
    assert.deepEqual((await paymentAttempt(db, owner, r.id, id)).receipt, a);
    await assert.rejects(
      changePayment(db, owner, "stale", r.id, {
        action: "void",
        revision: 0,
        reason: "Wrong entry",
      }),
      /booking_conflict/,
    );
    await db.prepare("UPDATE property SET owner_id='other' WHERE id='p'").run();
    await assert.rejects(applyPayment(db, owner, r.id, id), /not_found/);
    await assert.rejects(ownerPayments(db, guest, r.id), /not_found/);
  } finally {
    await p.dispose();
  }
});
test("competing record/void operations and write-time ownership/verification/projection failures leave atomic history and receipts", async () => {
  const p = await database();
  try {
    const db = p.db,
      r = await ready(db);
    const result = await Promise.allSettled([
      changePayment(db, owner, "one", r.id, { action: "record", revision: 0 }),
      changePayment(db, owner, "two", r.id, { action: "record", revision: 0 }),
    ]);
    assert.equal(result.filter((x) => x.status === "fulfilled").length, 1);
    const voids = await Promise.allSettled([
      changePayment(db, owner, "v1", r.id, {
        action: "void",
        revision: 1,
        reason: "Mistake",
      }),
      changePayment(db, owner, "v2", r.id, {
        action: "void",
        revision: 1,
        reason: "Mistake",
      }),
    ]);
    assert.equal(voids.filter((x) => x.status === "fulfilled").length, 1);
    assert.equal((await ownerPayments(db, owner, r.id)).events.length, 2);
  } finally {
    await p.dispose();
  }
  for (const failure of ["owner", "verified", "projection", "receipt"]) {
    const q = await database();
    try {
      const db = q.db,
        r = await ready(db);
      const count = await scalar(db, "SELECT count(*) n FROM operation");
      if (failure === "projection")
        await db
          .prepare(
            "CREATE TRIGGER invalid_payment_fixture BEFORE INSERT ON booking_payment_state BEGIN SELECT RAISE(ABORT,'invalid_fixture_projection'); END",
          )
          .run();
      if (failure === "receipt")
        await db
          .prepare(
            "CREATE TRIGGER invalid_payment_receipt_fixture BEFORE UPDATE OF result_json ON operation WHEN NEW.kind='payment_record' BEGIN SELECT RAISE(ABORT,'invalid_fixture_receipt'); END",
          )
          .run();
      let once = true;
      const racing = new Proxy(db, {
        get(target, prop) {
          if (prop === "batch")
            return async (...args: Parameters<D1Database["batch"]>) => {
              if (once) {
                once = false;
                if (failure === "owner")
                  await target
                    .prepare(
                      "UPDATE property SET owner_id='other' WHERE id='p'",
                    )
                    .run();
                if (failure === "verified")
                  await target
                    .prepare("UPDATE user SET emailVerified=0 WHERE id='owner'")
                    .run();
              }
              return target.batch(...args);
            };
          const v = Reflect.get(target, prop);
          return typeof v === "function" ? v.bind(target) : v;
        },
      });
      await assert.rejects(
        changePayment(racing, owner, "race", r.id, {
          action: "record",
          revision: 0,
        }),
        /booking_conflict/,
      );
      assert.equal(await scalar(db, "SELECT count(*) n FROM operation"), count);
      assert.equal(
        await scalar(db, "SELECT count(*) n FROM booking_payment_event"),
        0,
      );
      assert.equal(
        await scalar(db, "SELECT count(*) n FROM booking_payment_state"),
        0,
      );
    } finally {
      await q.dispose();
    }
  }
});
test("only eligible positive-total stays accept full records; input rejects arbitrary amounts, currency, timing and absent correction reasons", async () => {
  const p = await database();
  try {
    const db = p.db,
      { input } = await catalog(db),
      r = await request(db, input);
    await assert.rejects(
      changePayment(db, owner, "pending", r.id, {
        action: "record",
        revision: 0,
      }),
      /booking_conflict/,
    );
    await testTransition(db, owner, "accept", r.id, "accept");
    await assert.rejects(
      changePayment(db, owner, "confirmed", r.id, {
        action: "record",
        revision: 0,
      }),
      /booking_conflict/,
    );
    await assert.rejects(
      changePayment(db, unverified, "bad", r.id, {
        action: "record",
        revision: 0,
      }),
      /verified_session_required/,
    );
    for (const value of [
      null,
      { action: "record", revision: 0, amountCents: 100 },
      { action: "record", revision: 0, currency: "KHR" },
      { action: "record", revision: -1 },
      { action: "record", revision: 0, paidAt: 1 },
      { action: "void", revision: 1 },
      { action: "void", revision: 1, reason: "\u0000" },
    ])
      assert.throws(() => paymentInput(value), /invalid_payment/);
    await db.prepare("UPDATE nightly_rate SET unit_cents=0").run();
    await db.prepare("UPDATE property SET charges_json='[]'").run();
    const free = await request(db, input, "free");
    await testTransition(db, owner, "accept-free", free.id, "accept");
    await atScheduledArrival(db, free.id);
    await transition(db, owner, "arrive-free", free.id, "check_in");
    assert.equal(
      (await ownerPayments(db, owner, free.id)).status,
      "no_payment_due",
    );
    await assert.rejects(
      changePayment(db, owner, "free-record", free.id, {
        action: "record",
        revision: 0,
      }),
      /booking_conflict/,
    );
  } finally {
    await p.dispose();
  }
});
test("0015 upgrade keeps older booking/operation data and starts with no fabricated payments or drafts", async () => {
  const p = await database({ migrate: false });
  try {
    const db = p.db;
    await migrate(
      db,
      env.TEST_MIGRATIONS.filter((m) => m.name < "0016").map((m) => m.name),
    );
    const r = await ready(db);
    const tables = [
      "booking",
      "operation",
      "booking_event",
      "allocation",
      "notification_outbox",
    ];
    const snapshot = () =>
      Promise.all(
        tables.map(
          async (t) =>
            (await db.prepare("SELECT * FROM " + t + " ORDER BY rowid").all())
              .results,
        ),
      );
    const before = await snapshot();
    await migrate(db);
    await migrate(db);
    assert.deepEqual(await snapshot(), before);
    assert.equal(
      await scalar(db, "SELECT count(*) n FROM booking_payment_event"),
      0,
    );
    assert.equal(
      await scalar(db, "SELECT count(*) n FROM booking_payment_state"),
      0,
    );
    assert.equal(
      (await guestBooking(db, guest, r.id)).payment.status,
      "not_recorded",
    );
  } finally {
    await p.dispose();
  }
});

test("owner payment history is bounded, stable across equal timestamps and private across accounts", async () => {
  const p = await database();
  try {
    const db = p.db,
      r = await ready(db);
    for (let revision = 0; revision < 24; revision++)
      await changePayment(
        db,
        owner,
        "history-" + revision,
        r.id,
        revision % 2
          ? { action: "void", revision, reason: "Correction " + revision }
          : { action: "record", revision },
      );
    const newest = await ownerPayments(db, owner, r.id);
    assert.equal(newest.events.length, 20);
    assert.equal(newest.nextCursor, "5");
    assert.deepEqual(
      newest.events.map((e) => e.revision),
      Array.from({ length: 20 }, (_, i) => 24 - i),
    );
    const older = await ownerPayments(db, owner, r.id, newest.nextCursor);
    assert.deepEqual(
      older.events.map((e) => e.revision),
      [4, 3, 2, 1],
    );
    assert.equal(older.nextCursor, null);
    assert.equal(older.revision, 24);
    await assert.rejects(
      ownerPayments(db, other, r.id, newest.nextCursor),
      /not_found/,
    );
    await assert.rejects(
      ownerPayments(db, owner, r.id, "-1"),
      /invalid_request/,
    );
  } finally {
    await p.dispose();
  }
});
