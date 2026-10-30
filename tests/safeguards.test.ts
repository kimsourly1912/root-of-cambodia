import { test } from "vitest";
import assert from "node:assert/strict";
import { database, catalog, request, scalar } from "./support";
import { testTransition as transition } from "./booking-fixtures";

type Values = Record<string, string | number | null>;

// Trusted SQL fixtures intentionally bypass services to test the final database boundary.
export async function draft(
  db: D1Database,
  original: string,
  overrides: Values = {},
) {
  const values: Values = {
    id: crypto.randomUUID(),
    status: "building",
    ...overrides,
  };
  const columns = (
    await db.prepare("PRAGMA table_info(booking)").all<{ name: string }>()
  ).results.map((c) => c.name);
  return db
    .prepare(
      "INSERT INTO booking(" +
        columns.join(",") +
        ") SELECT " +
        columns.map((c) => (Object.hasOwn(values, c) ? "?" : c)).join(",") +
        " FROM booking WHERE id=?",
    )
    .bind(
      ...columns.filter((c) => Object.hasOwn(values, c)).map((c) => values[c]),
      original,
    );
}

function command(
  db: D1Database,
  id: string,
  kind: string,
  role: "guest" | "owner",
) {
  return db
    .prepare(
      "INSERT INTO operation(id,principal,actor_id,key,fingerprint,kind,actor_role) VALUES (?,?,?,?,?,?,?)",
    )
    .bind(id, "user:" + role, role, id, "trusted-fixture", kind, role);
}

async function state(db: D1Database, id: string) {
  return db
    .prepare(
      "SELECT status,(SELECT sum(reserved) FROM inventory_night) reserved,(SELECT count(*) FROM allocation) allocations,(SELECT count(*) FROM booking_event) events,(SELECT count(*) FROM notification_outbox) notifications,(SELECT count(*) FROM operation) operations FROM booking WHERE id=?",
    )
    .bind(id)
    .first();
}

async function scenario(run: (db: D1Database, id: string) => Promise<void>) {
  const p = await database();
  try {
    const { input } = await catalog(p.db);
    const r = await request(p.db, input);
    await run(p.db, r.id);
  } finally {
    await p.dispose();
  }
}

test.each([
  ["confirmed", "decline"],
  ["declined", "accept"],
  ["cancelled", "accept"],
  ["checked_in", "checked_in_import"],
  ["completed", "accept"],
])(
  "rejects %s carrying the wrong %s command and rolls back all effects",
  (status, kind) =>
    scenario(async (db, id) => {
      if (status === "checked_in" || status === "completed") {
        await transition(db, { id: "owner" }, "accept-fixture", id, "accept");
      }
      if (status === "completed") {
        const arrival = crypto.randomUUID();
        await db.batch([
          command(db, arrival, "check_in", "owner"),
          db
            .prepare(
              "UPDATE booking SET status='checked_in',last_operation_id=? WHERE id=?",
            )
            .bind(arrival, id),
        ]);
      }
      const before = await state(db, id),
        op = crypto.randomUUID();
      await assert.rejects(
        db.batch([
          command(db, op, kind, "owner"),
          db
            .prepare(
              "UPDATE booking SET status=?,last_operation_id=?,reason='Required fixture reason' WHERE id=?",
            )
            .bind(status, op, id),
        ]),
        /invalid_operation_kind/,
      );
      assert.deepEqual(await state(db, id), before);
    }),
);

async function arrived(db: D1Database, original: string) {
  const clock = await db
    .prepare(
      "SELECT unixepoch()-(unixepoch()%60) instant,date('now','+7 hours') day,strftime('%H:%M','now','+7 hours') time,date('now','+7 hours','+2 days') checkout",
    )
    .first<{ instant: number; day: string; time: string; checkout: string }>();
  assert.ok(clock);
  const id = crypto.randomUUID(),
    op = crypto.randomUUID();
  await db.batch([
    command(db, op, "submit", "owner"),
    await draft(db, original, {
      id,
      last_operation_id: op,
      source: "external",
      checkin_date: clock.day,
      checkin_at: clock.instant,
      checkin_time: clock.time,
      checkout_date: clock.checkout,
      checkout_at: Date.parse(clock.checkout + "T11:00:00+07:00") / 1000,
      checkout_time: "11:00",
    }),
    db
      .prepare(
        "INSERT INTO booking_line SELECT id||?, ?,property_id,room_type_id,room_name,quantity,adults,children,adult_capacity,child_capacity,total_capacity FROM booking_line WHERE booking_id=?",
      )
      .bind(id, id, original),
    db
      .prepare(
        "INSERT INTO booking_night SELECT n.line_id||?,date(?, '+'||(julianday(n.night)-julianday(b.checkin_date))||' days'),n.unit_cents FROM booking_night n JOIN booking_line l ON l.id=n.line_id JOIN booking b ON b.id=l.booking_id WHERE b.id=?",
      )
      .bind(id, clock.day, original),
    db
      .prepare(
        "INSERT INTO booking_charge SELECT ?,code,label,amount_cents FROM booking_charge WHERE booking_id=?",
      )
      .bind(id, original),
    db
      .prepare(
        "INSERT OR IGNORE INTO inventory_night(room_type_id,night,capacity) SELECT l.room_type_id,n.night,2 FROM booking_line l JOIN booking_night n ON n.line_id=l.id WHERE l.booking_id=?",
      )
      .bind(id),
    db.prepare("UPDATE booking SET status='confirmed' WHERE id=?").bind(id),
  ]);
  assert.equal(
    await scalar(
      db,
      "SELECT count(*) n FROM booking WHERE id=? AND checkin_at<=unixepoch()",
      id,
    ),
    1,
  );
  return id;
}

test.each(["guest", "owner"] as const)(
  "%s cancellation at/past the scheduled minute cannot release stock",
  (role) =>
    scenario(async (db, original) => {
      const id = await arrived(db, original),
        before = await state(db, id),
        op = crypto.randomUUID();
      await assert.rejects(
        db.batch([
          command(db, op, "cancel_" + role, role),
          db
            .prepare(
              "UPDATE booking SET status='cancelled',last_operation_id=?,reason='Fixture reason' WHERE id=?",
            )
            .bind(op, id),
        ]),
        /cancellation_cutoff/,
      );
      assert.deepEqual(await state(db, id), before);
    }),
);

const nullInserts: [
  string,
  (db: D1Database, id: string) => Promise<D1PreparedStatement>,
][] = [
  [
    "owner_profile",
    async (db) =>
      db.prepare("INSERT INTO owner_profile VALUES(NULL,'Null identity')"),
  ],
  [
    "place",
    async (db) =>
      db.prepare(
        "INSERT INTO place(id,name_km,name_en,province) VALUES(NULL,'Null','Null','Kampot')",
      ),
  ],
  [
    "property",
    async (db) =>
      db.prepare(
        "INSERT INTO property(id,owner_id,checkin_time,checkout_time,policy_version,policy_text,terms_version) VALUES(NULL,'owner','14:00','11:00','v1','Rules','v1')",
      ),
  ],
  [
    "room_type",
    async (db) =>
      db.prepare(
        "INSERT INTO room_type(id,property_id,name,adult_capacity,child_capacity,total_capacity) VALUES(NULL,'p','Room',2,1,3)",
      ),
  ],
  [
    "operation",
    async (db) =>
      db.prepare(
        "INSERT INTO operation(id,principal,actor_id,key,fingerprint,kind,actor_role) VALUES(NULL,'user:owner','owner','null-id','fixture','accept','owner')",
      ),
  ],
  [
    "operation_assert",
    async (db) => db.prepare("INSERT INTO operation_assert VALUES(NULL,1)"),
  ],
  ["booking", async (db, id) => draft(db, id, { id: null })],
  [
    "booking_line",
    async (db, id) => {
      const building = crypto.randomUUID();
      await (await draft(db, id, { id: building })).run();
      return db
        .prepare(
          "INSERT INTO booking_line VALUES(NULL,?,'p','r','Room',1,2,0,2,1,3)",
        )
        .bind(building);
    },
  ],
  [
    "booking_event",
    async (db, id) =>
      db
        .prepare(
          "INSERT INTO booking_event(id,booking_id,operation_id,actor_id,kind,actor_role) SELECT NULL,id,last_operation_id,'guest','null-fixture','guest' FROM booking WHERE id=?",
        )
        .bind(id),
  ],
  [
    "notification_outbox",
    async (db, id) =>
      db
        .prepare(
          "INSERT INTO notification_outbox(id,event_id,recipient_id) SELECT NULL,id,'other' FROM booking_event WHERE booking_id=? LIMIT 1",
        )
        .bind(id),
  ],
  [
    "inventory_event",
    async (db) =>
      db.prepare(
        "INSERT INTO inventory_event(operation_id,room_type_id,night,capacity,blocked,actor_id) SELECT NULL,room_type_id,night,capacity,blocked,'owner' FROM inventory_night LIMIT 1",
      ),
  ],
];
test.each(nullInserts)("%s rejects a null business identity", (_, insert) =>
  scenario(async (db, id) => {
    await assert.rejects(
      (await insert(db, id)).run(),
      /null_business_identity/,
    );
  }),
);

test("identity updates cannot introduce a null key", () =>
  scenario(async (db) => {
    await db
      .prepare(
        "INSERT INTO place(id,name_km,name_en,province) VALUES('unused','Unused','Unused','Kampot')",
      )
      .run();
    await assert.rejects(
      db.prepare("UPDATE place SET id=NULL WHERE id='unused'").run(),
      /null_business_identity/,
    );
  }));

const invalidSchedules: Values[] = [
  { checkin_at: 1e15, checkout_at: 2e15 },
  { submitted_at: 1e15, expires_at: 1e15 + 43200 },
  { checkin_time: "15:00" },
  { checkout_time: "25:00" },
];
test.each(invalidSchedules)(
  "rejects an invalid or incoherent saved schedule: %j",
  (overrides) =>
    scenario(async (db, id) => {
      await assert.rejects(
        (await draft(db, id, overrides)).run(),
        /invalid_booking_schedule/,
      );
    }),
);

test("coherent Cambodia midnight is a valid saved schedule", () =>
  scenario(async (db, id) => {
    const row = await db
      .prepare("SELECT checkin_date FROM booking WHERE id=?")
      .bind(id)
      .first<{ checkin_date: string }>();
    assert.ok(row);
    await (
      await draft(db, id, {
        checkin_time: "00:00",
        checkin_at: Date.parse(row.checkin_date + "T00:00:00+07:00") / 1000,
      })
    ).run();
  }));

test("a committed command cannot be relabelled or its receipt overwritten", () =>
  scenario(async (db, id) => {
    await assert.rejects(
      db
        .prepare(
          "UPDATE operation SET kind='accept' WHERE id=(SELECT last_operation_id FROM booking WHERE id=?)",
        )
        .bind(id)
        .run(),
      /immutable_operation_context/,
    );
    await assert.rejects(
      db
        .prepare(
          "UPDATE operation SET result_json='{}' WHERE id=(SELECT last_operation_id FROM booking WHERE id=?)",
        )
        .bind(id)
        .run(),
      /immutable_operation_context/,
    );
  }));
