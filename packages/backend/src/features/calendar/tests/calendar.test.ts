import { test } from "vitest";
import assert from "node:assert/strict";
import {
  database,
  catalog,
  request,
  owner,
  other,
  guest,
  unverified,
  scalar,
} from "../../../testing/support";
import { createPropertyDraft } from "@root-of-cambodia/backend/properties";
import { createRoomType } from "@root-of-cambodia/backend/rooms";
import {
  saveRoomCalendar,
  type CalendarEdit,
} from "@root-of-cambodia/backend/calendar";
import { ownerRoomCalendar } from "@root-of-cambodia/backend/calendar";
import { commitRoomCalendar } from "../calendar-persistence";
import { digest } from "@root-of-cambodia/backend/shared";
import { testTransition as transition } from "../../../testing/booking-fixtures";
import { readBooking } from "@root-of-cambodia/backend/shared";
import { quote } from "@root-of-cambodia/backend/quotes";
const start = "2027-01-03";
const propertyFields = {
  ownerName: "Owner",
  nameKm: "ផ្ទះ",
  nameEn: "House",
  province: "Kampot",
  checkinTime: "14:00",
  checkoutTime: "11:00",
  policyText: "Quiet hours.",
};
async function setup(db: D1Database) {
  await catalog(db);
  const property = await createPropertyDraft(
    db,
    owner,
    "property",
    propertyFields,
  );
  const room = await createRoomType(db, owner, "room", property.id, {
    name: "Twin",
    adultCapacity: 2,
    childCapacity: 1,
    totalCapacity: 3,
  });
  return { propertyId: property.id, roomId: room.id };
}
async function edit(
  db: D1Database,
  propertyId: string,
  roomId: string,
  count = 2,
): Promise<CalendarEdit> {
  const view = await ownerRoomCalendar(db, owner, propertyId, roomId, start);
  return {
    roomRevision: view.roomRevision,
    nights: view.nights
      .slice(0, count)
      .map((n) => ({
        night: n.night,
        capacity: 3,
        blocked: 1,
        unitCents: 1999,
        inventoryRevision: n.inventoryRevision,
        rateRevision: n.rateRevision,
      })),
  };
}
function save(
  db: D1Database,
  ids: { propertyId: string; roomId: string },
  key: string,
  input: CalendarEdit,
) {
  return saveRoomCalendar(db, owner, key, ids.propertyId, ids.roomId, input);
}
async function rows(db: D1Database, roomId: string) {
  return {
    stock: (
      await db
        .prepare(
          "SELECT * FROM inventory_night WHERE room_type_id=? ORDER BY night",
        )
        .bind(roomId)
        .all()
    ).results,
    rates: (
      await db
        .prepare(
          "SELECT * FROM nightly_rate WHERE room_type_id=? ORDER BY night",
        )
        .bind(roomId)
        .all()
    ).results,
    events: (
      await db
        .prepare(
          "SELECT * FROM room_calendar_event WHERE room_type_id=? ORDER BY night,inventory_revision",
        )
        .bind(roomId)
        .all()
    ).results,
    operations: (
      await db
        .prepare(
          "SELECT * FROM operation WHERE kind='room_calendar' ORDER BY rowid",
        )
        .all()
    ).results,
  };
}
test("calendar reads missing and partial rows and atomically stores canonical prices, inventory, history and receipts", async () => {
  const p = await database();
  try {
    const db = p.db,
      ids = await setup(db);
    let view = await ownerRoomCalendar(
      db,
      owner,
      ids.propertyId,
      ids.roomId,
      start,
    );
    assert.equal(view.nights.length, 7);
    assert.ok(
      view.nights.every((n) => n.capacity === null && n.unitCents === null),
    );
    await db
      .prepare(
        "INSERT INTO nightly_rate(room_type_id,night,unit_cents) VALUES (?,?,1100)",
      )
      .bind(ids.roomId, "2027-01-04")
      .run();
    await db
      .prepare(
        "INSERT INTO inventory_night(room_type_id,night,capacity) VALUES (?,?,2)",
      )
      .bind(ids.roomId, "2027-01-05")
      .run();
    const input = await edit(db, ids.propertyId, ids.roomId, 3);
    assert.deepEqual(
      input.nights.map((n) => [n.inventoryRevision, n.rateRevision]),
      [
        [null, null],
        [null, 1],
        [1, null],
      ],
    );
    const receipt = await save(db, ids, "calendar", input);
    assert.deepEqual(receipt, { id: ids.roomId, status: "updated" });
    view = await ownerRoomCalendar(
      db,
      owner,
      ids.propertyId,
      ids.roomId,
      start,
    );
    assert.deepEqual(
      view.nights
        .slice(0, 3)
        .map((n) => [
          n.capacity,
          n.blocked,
          n.reserved,
          n.unitCents,
          n.inventoryRevision,
          n.rateRevision,
        ]),
      [
        [3, 1, 0, 1999, 1, 1],
        [3, 1, 0, 1999, 1, 2],
        [3, 1, 0, 1999, 2, 1],
      ],
    );
    assert.equal(
      await scalar(
        db,
        "SELECT count(*) n FROM room_calendar_event WHERE room_type_id=?",
        ids.roomId,
      ),
      3,
    );
    const operation = await db
      .prepare("SELECT fingerprint FROM operation WHERE key='calendar'")
      .first<{ fingerprint: string }>();
    assert.equal(
      operation?.fingerprint,
      await digest({
        role: "owner",
        payload: { kind: "room_calendar", ...ids, fields: input },
      }),
    );
    assert.deepEqual(
      await save(db, ids, "calendar", {
        ...input,
        nights: [...input.nights].reverse(),
      }),
      receipt,
    );
    await db
      .prepare("UPDATE room_type SET name='Renamed' WHERE id=?")
      .bind(ids.roomId)
      .run();
    await db
      .prepare("UPDATE place SET publication='review' WHERE id=?")
      .bind(ids.propertyId)
      .run();
    assert.deepEqual(await save(db, ids, "calendar", input), receipt);
    await assert.rejects(
      save(db, ids, "new-op", await edit(db, ids.propertyId, ids.roomId)),
      /booking_conflict/,
    );
  } finally {
    await p.dispose();
  }
});
test("calendar reads, writes and receipt recovery require current verification, ownership and exact parent", async () => {
  const p = await database();
  try {
    const db = p.db,
      ids = await setup(db),
      input = await edit(db, ids.propertyId, ids.roomId);
    await save(db, ids, "calendar", input);
    for (const actor of [other, unverified]) {
      await assert.rejects(
        ownerRoomCalendar(db, actor, ids.propertyId, ids.roomId, start),
        actor === other ? /not_found/ : /verified_session_required/,
      );
      await assert.rejects(
        saveRoomCalendar(db, actor, "bad", ids.propertyId, ids.roomId, input),
        actor === other ? /not_found/ : /verified_session_required/,
      );
    }
    await assert.rejects(
      ownerRoomCalendar(db, owner, "p", ids.roomId, start),
      /not_found/,
    );
    await assert.rejects(
      saveRoomCalendar(db, owner, "wrong-parent", "p", ids.roomId, input),
      /not_found/,
    );
    await db.prepare("UPDATE user SET emailVerified=0 WHERE id='owner'").run();
    await assert.rejects(
      save(db, ids, "calendar", input),
      /verified_session_required/,
    );
    await db.prepare("UPDATE user SET emailVerified=1 WHERE id='owner'").run();
    await db
      .prepare("UPDATE property SET owner_id='other' WHERE id=?")
      .bind(ids.propertyId)
      .run();
    await assert.rejects(save(db, ids, "calendar", input), /not_found/);
  } finally {
    await p.dispose();
  }
});
test("competing creators cannot overwrite an absent date and concurrent multi-night saves have one winner", async () => {
  const p = await database();
  try {
    const db = p.db,
      ids = await setup(db),
      input = await edit(db, ids.propertyId, ids.roomId);
    const result = await Promise.allSettled(
      [2000, 3000].map((unitCents) =>
        save(db, ids, "price-" + unitCents, {
          ...input,
          nights: input.nights.map((n) => ({ ...n, unitCents })),
        }),
      ),
    );
    assert.equal(result.filter((x) => x.status === "fulfilled").length, 1);
    const view = await ownerRoomCalendar(
      db,
      owner,
      ids.propertyId,
      ids.roomId,
      start,
    );
    assert.equal(view.nights[0].unitCents, view.nights[1].unitCents);
    assert.equal(
      await scalar(
        db,
        "SELECT count(*) n FROM operation WHERE kind='room_calendar'",
      ),
      1,
    );
    assert.equal(
      await scalar(db, "SELECT count(*) n FROM room_calendar_event"),
      2,
    );
  } finally {
    await p.dispose();
  }
});
test("a stale last-night rate rolls back earlier-night changes and all new history/receipts", async () => {
  const p = await database();
  try {
    const db = p.db,
      ids = await setup(db);
    await save(db, ids, "initial", await edit(db, ids.propertyId, ids.roomId));
    const input = await edit(db, ids.propertyId, ids.roomId);
    await db
      .prepare(
        "UPDATE nightly_rate SET unit_cents=3500 WHERE room_type_id=? AND night=?",
      )
      .bind(ids.roomId, input.nights[1].night)
      .run();
    const before = await rows(db, ids.roomId);
    await assert.rejects(
      save(db, ids, "stale", {
        ...input,
        nights: input.nights.map((n) => ({
          ...n,
          capacity: 8,
          unitCents: 999,
        })),
      }),
      /booking_conflict/,
    );
    assert.deepEqual(await rows(db, ids.roomId), before);
  } finally {
    await p.dispose();
  }
});
test("same-key races and a lost committed response recover one complete calendar operation", async () => {
  const p = await database();
  try {
    const db = p.db,
      ids = await setup(db),
      input = await edit(db, ids.propertyId, ids.roomId);
    const result = await Promise.all([
      save(db, ids, "race", input),
      save(db, ids, "race", input),
    ]);
    assert.deepEqual(result[0], result[1]);
    const next = await edit(db, ids.propertyId, ids.roomId);
    let lost = false;
    const flaky = new Proxy(db, {
      get(target, key) {
        if (key === "batch")
          return async (statements: D1PreparedStatement[]) => {
            const result = await target.batch(statements);
            if (!lost) {
              lost = true;
              throw new Error("Response lost after commit");
            }
            return result;
          };
        const value = Reflect.get(target, key);
        return typeof value === "function" ? value.bind(target) : value;
      },
    });
    const receipt = await save(flaky, ids, "lost", next);
    assert.deepEqual(await save(db, ids, "lost", next), receipt);
    assert.equal(
      await scalar(
        db,
        "SELECT count(*) n FROM operation WHERE kind='room_calendar'",
      ),
      2,
    );
    assert.equal(
      await scalar(db, "SELECT count(*) n FROM room_calendar_event"),
      4,
    );
    await assert.rejects(
      save(db, ids, "lost", {
        ...next,
        nights: next.nights.map((n) => ({ ...n, unitCents: 2001 })),
      }),
      /idempotency_conflict/,
    );
  } finally {
    await p.dispose();
  }
});
test("calendar price/stock edits preserve reserved counters, original booking snapshots, allocations and notifications", async () => {
  const p = await database();
  try {
    const db = p.db,
      { input } = await catalog(db, 4);
    const booking = await request(db, input);
    await transition(db, owner, "accept", booking.id, "accept");
    const before = await readBooking(db, guest, booking.id);
    const outbox = await scalar(
      db,
      "SELECT count(*) n FROM notification_outbox",
    );
    // Trusted historical fixture: setup view still must preserve previously recorded bookings.
    await db.prepare("UPDATE place SET publication='draft' WHERE id='p'").run();
    const view = await ownerRoomCalendar(db, owner, "p", "r", input.checkin);
    const fields = {
      roomRevision: view.roomRevision,
      nights: view.nights
        .slice(0, 2)
        .map((n) => ({
          night: n.night,
          capacity: 4,
          blocked: 1,
          unitCents: 2501,
          inventoryRevision: n.inventoryRevision,
          rateRevision: n.rateRevision,
        })),
    };
    await assert.rejects(
      saveRoomCalendar(db, owner, "too-few", "p", "r", {
        ...fields,
        nights: fields.nights.map((n) => ({ ...n, capacity: 0, blocked: 0 })),
      }),
      /booking_conflict/,
    );
    assert.equal(
      await scalar(db, "SELECT count(*) n FROM room_calendar_event"),
      0,
    );
    await saveRoomCalendar(db, owner, "valid", "p", "r", fields);
    const after = await ownerRoomCalendar(db, owner, "p", "r", input.checkin);
    assert.ok(
      after.nights
        .slice(0, 2)
        .every((n) => n.reserved === 1 && n.unitCents === 2501),
    );
    assert.deepEqual(await readBooking(db, guest, booking.id), before);
    assert.equal(
      await scalar(db, "SELECT count(*) n FROM notification_outbox"),
      outbox,
    );
    assert.equal(
      await scalar(db, "SELECT count(*) n FROM allocation WHERE released=0"),
      2,
    );
  } finally {
    await p.dispose();
  }
});
test("a reservation arriving after the calendar read cannot be overwritten even without an inventory revision change", async () => {
  const p = await database();
  try {
    const db = p.db,
      { input } = await catalog(db, 4);
    const booking = await request(db, input);
    await db.prepare("UPDATE place SET publication='draft' WHERE id='p'").run();
    const view = await ownerRoomCalendar(db, owner, "p", "r", input.checkin);
    const fields = {
      roomRevision: view.roomRevision,
      nights: [
        {
          night: input.checkin,
          capacity: 0,
          blocked: 0,
          unitCents: 1000,
          inventoryRevision: 1,
          rateRevision: 1,
        },
      ],
    };
    let accepted = false;
    const concurrent = new Proxy(db, {
      get(target, key) {
        if (key === "batch")
          return async (statements: D1PreparedStatement[]) => {
            if (!accepted) {
              accepted = true;
              await transition(
                target,
                owner,
                "concurrent-accept",
                booking.id,
                "accept",
              );
            }
            return target.batch(statements);
          };
        const value = Reflect.get(target, key);
        return typeof value === "function" ? value.bind(target) : value;
      },
    });
    await assert.rejects(
      saveRoomCalendar(concurrent, owner, "reduce", "p", "r", fields),
      /booking_conflict/,
    );
    assert.equal(
      (await readBooking(db, guest, booking.id)).status,
      "confirmed",
    );
    const after = await ownerRoomCalendar(db, owner, "p", "r", input.checkin);
    assert.equal(after.nights[0].reserved, 1);
    assert.equal(after.nights[0].capacity, 4);
    assert.equal(after.nights[0].inventoryRevision, 1);
    assert.equal(after.nights[0].unitCents, 3500);
    assert.equal(
      await scalar(db, "SELECT count(*) n FROM room_calendar_event"),
      0,
    );
  } finally {
    await p.dispose();
  }
});
test("write-time ownership, verification, publication and room-version changes reject the entire calendar save", async () => {
  for (const change of ["owner", "verification", "publication", "room"]) {
    const p = await database();
    try {
      const db = p.db,
        ids = await setup(db),
        input = await edit(db, ids.propertyId, ids.roomId);
      let changed = false;
      const concurrent = new Proxy(db, {
        get(target, key) {
          if (key === "batch")
            return async (statements: D1PreparedStatement[]) => {
              if (!changed) {
                changed = true;
                const sql =
                  change === "owner"
                    ? "UPDATE property SET owner_id='other' WHERE id=?"
                    : change === "verification"
                      ? "UPDATE user SET emailVerified=0 WHERE id=?"
                      : change === "publication"
                        ? "UPDATE place SET publication='review' WHERE id=?"
                        : "UPDATE room_type SET name='Changed' WHERE id=?";
                await target
                  .prepare(sql)
                  .bind(
                    change === "verification"
                      ? owner.id
                      : change === "room"
                        ? ids.roomId
                        : ids.propertyId,
                  )
                  .run();
              }
              return target.batch(statements);
            };
          const value = Reflect.get(target, key);
          return typeof value === "function" ? value.bind(target) : value;
        },
      });
      await assert.rejects(
        save(concurrent, ids, "revoked", input),
        /booking_conflict/,
      );
      assert.deepEqual(await rows(db, ids.roomId), {
        stock: [],
        rates: [],
        events: [],
        operations: [],
      });
    } finally {
      await p.dispose();
    }
  }
});
test("calendar history failure rolls back stock and rates for every date, and history rejects forged actors and mutation", async () => {
  const p = await database();
  try {
    const db = p.db,
      ids = await setup(db),
      input = await edit(db, ids.propertyId, ids.roomId);
    await assert.rejects(
      commitRoomCalendar(
        db,
        unverified,
        "bad",
        ids.propertyId,
        ids.roomId,
        input,
      ),
      /booking_conflict/,
    );
    await db
      .prepare(
        "CREATE TRIGGER fail_calendar BEFORE INSERT ON room_calendar_event WHEN NEW.night='2027-01-04' BEGIN SELECT RAISE(ABORT,'invalid_test_history'); END",
      )
      .run();
    await assert.rejects(save(db, ids, "failed", input), /booking_conflict/);
    assert.deepEqual(await rows(db, ids.roomId), {
      stock: [],
      rates: [],
      events: [],
      operations: [],
    });
    await db.prepare("DROP TRIGGER fail_calendar").run();
    await save(db, ids, "good", input);
    await assert.rejects(
      db.prepare("UPDATE room_calendar_event SET actor_id='other'").run(),
      /immutable_calendar_history/,
    );
    await assert.rejects(
      db.prepare("DELETE FROM room_calendar_event").run(),
      /immutable_calendar_history/,
    );
    await assert.rejects(
      db
        .prepare(
          "INSERT INTO room_calendar_event SELECT 'forged',room_type_id,night,'other',capacity,blocked,reserved,unit_cents,inventory_revision,rate_revision,room_revision,occurred_at FROM room_calendar_event LIMIT 1",
        )
        .run(),
      /invalid_calendar_actor/,
    );
  } finally {
    await p.dispose();
  }
});
test("calendar validation rejects malformed dates, versions, money, injected reserved counters and oversized windows", async () => {
  const p = await database();
  try {
    const db = p.db,
      ids = await setup(db),
      input = await edit(db, ids.propertyId, ids.roomId, 1),
      night = input.nights[0];
    const badNights = [
      { ...night, night: "2027-02-30" },
      { ...night, capacity: -1 },
      { ...night, capacity: 10001 },
      { ...night, blocked: 4 },
      { ...night, unitCents: 1.5 },
      { ...night, unitCents: 100000001 },
      { ...night, unitCents: "19.99" },
      { ...night, inventoryRevision: 0 },
      { ...night, rateRevision: undefined },
      { ...night, reserved: 0 },
    ];
    for (const n of badNights)
      await assert.rejects(
        saveRoomCalendar(
          db,
          owner,
          crypto.randomUUID(),
          ids.propertyId,
          ids.roomId,
          { roomRevision: 1, nights: [n] },
        ),
        /invalid_calendar/,
      );
    for (const patch of [
      { roomRevision: 0 },
      { ownerId: "owner" },
      { nights: [] },
      {
        nights: Array.from({ length: 8 }, (_, i) => ({
          ...night,
          night: "2027-01-" + String(i + 3).padStart(2, "0"),
        })),
      },
      { nights: [night, night] },
      { nights: [night, { ...night, night: "2027-01-10" }] },
    ])
      await assert.rejects(
        saveRoomCalendar(
          db,
          owner,
          crypto.randomUUID(),
          ids.propertyId,
          ids.roomId,
          { ...input, ...patch },
        ),
        /invalid_calendar/,
      );
    await assert.rejects(
      ownerRoomCalendar(db, owner, ids.propertyId, ids.roomId, "2027-02-30"),
      /invalid_dates/,
    );
    assert.deepEqual(
      (
        await ownerRoomCalendar(
          db,
          owner,
          ids.propertyId,
          ids.roomId,
          "2028-02-27",
        )
      ).nights.map((n) => n.night),
      [
        "2028-02-27",
        "2028-02-28",
        "2028-02-29",
        "2028-03-01",
        "2028-03-02",
        "2028-03-03",
        "2028-03-04",
      ],
    );
    assert.equal(
      await scalar(
        db,
        "SELECT count(*) n FROM operation WHERE kind='room_calendar'",
      ),
      0,
    );
  } finally {
    await p.dispose();
  }
});
test("setting nightly stock and prices keeps public guest quotes blocked for private property drafts", async () => {
  const p = await database();
  try {
    const db = p.db,
      ids = await setup(db);
    await save(db, ids, "calendar", await edit(db, ids.propertyId, ids.roomId));
    await assert.rejects(
      quote(db, guest, {
        propertyId: ids.propertyId,
        checkin: start,
        checkout: "2027-01-05",
        termsVersion: "unconfigured",
        lines: [{ roomId: ids.roomId, quantity: 1, adults: 1, children: 0 }],
      }),
      /not_found/,
    );
  } finally {
    await p.dispose();
  }
});
