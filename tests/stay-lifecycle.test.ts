import { test } from "vitest";
import assert from "node:assert/strict";
import { env } from "cloudflare:workers";
import {
  database,
  catalog,
  request,
  owner,
  guest,
  other,
  unverified,
  scalar,
  migrate,
} from "./support";
import { testTransition } from "./booking-fixtures";
import { setStayClock, atScheduledArrival } from "./stay-fixtures";
import { transition } from "@root-of-cambodia/backend/bookings";
import { readBooking } from "@root-of-cambodia/backend/shared";
import { ownerStayReceipt } from "@root-of-cambodia/backend/bookings";
async function ready(db: D1Database) {
  const { input } = await catalog(db);
  const r = await request(db, input);
  await testTransition(db, owner, "accept", r.id, "accept");
  return r;
}
test("arrival includes scheduled check-in and excludes checkout; early/late attempts write nothing", async () => {
  for (const point of ["early", "start", "end-minus-one", "end"]) {
    const p = await database();
    try {
      const db = p.db,
        r = await ready(db),
        b = await readBooking(db, guest, r.id);
      const now =
        point === "early"
          ? b.checkinAt - 1
          : point === "start"
            ? b.checkinAt
            : point === "end-minus-one"
              ? b.checkoutAt - 1
              : b.checkoutAt;
      await setStayClock(db, r.id, now);
      const before = await scalar(db, "SELECT count(*) n FROM operation");
      if (point === "early" || point === "end") {
        await assert.rejects(
          transition(db, owner, "arrive", r.id, "check_in"),
          /booking_conflict/,
        );
        assert.equal(
          await scalar(db, "SELECT count(*) n FROM operation"),
          before,
        );
        assert.equal((await readBooking(db, guest, r.id)).status, "confirmed");
      } else
        assert.equal(
          (await transition(db, owner, "arrive", r.id, "check_in")).status,
          "checked_in",
        );
    } finally {
      await p.dispose();
    }
  }
});
test("arrival and completion retain prices/nights/stock and safely recover receipts after later state/time changes", async () => {
  const p = await database();
  try {
    const db = p.db,
      r = await ready(db),
      before = await readBooking(db, guest, r.id);
    await atScheduledArrival(db, r.id);
    const attempt = crypto.randomUUID(),
      key = "stay:" + attempt;
    const [a, b] = await Promise.all([
      transition(db, owner, key, r.id, "check_in"),
      transition(db, owner, key, r.id, "check_in"),
    ]);
    assert.deepEqual(a, b);
    const done = await transition(db, owner, "finish", r.id, "complete");
    assert.equal(done.status, "completed");
    await setStayClock(db, r.id, before.checkoutAt + 1);
    assert.deepEqual(await transition(db, owner, key, r.id, "check_in"), a);
    assert.deepEqual(
      await ownerStayReceipt(db, owner, r.id, { action: "check_in", attempt }),
      a,
    );
    const after = await readBooking(db, guest, r.id);
    for (const field of [
      "totalCents",
      "checkinAt",
      "checkoutAt",
      "checkinDate",
      "checkoutDate",
      "policyText",
    ] as const)
      assert.deepEqual(after[field], before[field]);
    assert.deepEqual(after.lines, before.lines);
    assert.equal(
      await scalar(db, "SELECT sum(reserved) n FROM inventory_night"),
      2,
    );
    assert.equal(
      await scalar(db, "SELECT count(*) n FROM allocation WHERE released=0"),
      2,
    );
    assert.equal(
      await scalar(
        db,
        "SELECT count(*) n FROM booking_event WHERE booking_id=? AND kind='checked_in'",
        r.id,
      ),
      1,
    );
    assert.equal(
      await scalar(
        db,
        "SELECT count(*) n FROM booking_event WHERE booking_id=? AND kind='completed'",
        r.id,
      ),
      1,
    );
    await assert.rejects(
      transition(db, owner, key, r.id, "complete"),
      /idempotency_conflict/,
    );
    await assert.rejects(
      transition(db, guest, "guest", r.id, "check_in"),
      /not_found/,
    );
    await assert.rejects(
      ownerStayReceipt(db, other, r.id, { action: "check_in", attempt }),
      /not_found/,
    );
  } finally {
    await p.dispose();
  }
});
test("current ownership/verification and required history/outbox failure roll back arrival and completion", async () => {
  for (const action of ["check_in", "complete"] as const)
    for (const failure of ["owner", "verified", "outbox"]) {
      const p = await database();
      try {
        const db = p.db,
          r = await ready(db);
        await atScheduledArrival(db, r.id);
        if (action === "complete")
          await transition(db, owner, "arrived", r.id, "check_in");
        const before = await readBooking(db, guest, r.id),
          count = await scalar(db, "SELECT count(*) n FROM operation");
        let once = true;
        if (failure === "outbox")
          await db
            .prepare(
              "CREATE TRIGGER fail_stay_outbox BEFORE INSERT ON notification_outbox BEGIN SELECT RAISE(ABORT,'invalid_fixture_outbox'); END",
            )
            .run();
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
                      .prepare(
                        "UPDATE user SET emailVerified=0 WHERE id='owner'",
                      )
                      .run();
                }
                return target.batch(...args);
              };
            const value = Reflect.get(target, prop);
            return typeof value === "function" ? value.bind(target) : value;
          },
        });
        await assert.rejects(
          transition(racing, owner, "race", r.id, action),
          /booking_conflict/,
        );
        assert.equal(
          await scalar(db, "SELECT count(*) n FROM operation"),
          count,
        );
        assert.equal(
          (await readBooking(db, guest, r.id)).status,
          before.status,
        );
      } finally {
        await p.dispose();
      }
    }
});
test("0014 upgrade keeps all earlier records/receipts and adds no invented arrival", async () => {
  const p = await database({ migrate: false });
  try {
    const db = p.db;
    await migrate(
      db,
      env.TEST_MIGRATIONS.filter((m) => m.name < "0015").map((m) => m.name),
    );
    const r = await ready(db);
    const before = (await db.prepare("SELECT * FROM booking").all()).results;
    const events = (
      await db.prepare("SELECT * FROM booking_event ORDER BY rowid").all()
    ).results;
    await migrate(db);
    assert.deepEqual(
      (await db.prepare("SELECT * FROM booking").all()).results,
      before,
    );
    assert.deepEqual(
      (await db.prepare("SELECT * FROM booking_event ORDER BY rowid").all())
        .results,
      events,
    );
    assert.equal((await readBooking(db, guest, r.id)).status, "confirmed");
    await assert.rejects(
      transition(db, unverified, "x", r.id, "check_in"),
      /verified_session_required/,
    );
  } finally {
    await p.dispose();
  }
});
