import { test } from "node:test";
import assert from "node:assert/strict";
import { database, catalog, request, guest, owner, scalar } from "./support";
import { quote } from "../src/quotes";
import { submit, transition, expireDue } from "../src/bookings";
// Infrastructure fixture: construct a historical Pending request through the same
// sealing trigger. No endpoint can backdate submitted_at or supply its own expiry.
async function historical(
  db: D1Database,
  original: string,
  expiresSQL: string,
) {
  const id = crypto.randomUUID(),
    op = crypto.randomUUID();
  const columns = (
    await db.prepare("PRAGMA table_info(booking)").all<{ name: string }>()
  ).results.map((c) => c.name);
  const overrides: Record<string, string> = {
    id: "?",
    status: "'building'",
    submitted_at: "(" + expiresSQL + ")-43200",
    expires_at: expiresSQL,
    last_operation_id: "?",
  };
  await db.batch([
    db
      .prepare(
        "INSERT INTO operation(id,principal,actor_id,key,fingerprint,kind,actor_role) VALUES (?,'user:guest','guest',?,'historical-fixture','submit','guest')",
      )
      .bind(op, op),
    db
      .prepare(
        "INSERT INTO booking(" +
          columns.join(",") +
          ") SELECT " +
          columns.map((c) => overrides[c] ?? c).join(",") +
          " FROM booking WHERE id=?",
      )
      .bind(id, op, original),
    db
      .prepare(
        "INSERT INTO booking_line SELECT id||?, ?,property_id,room_type_id,room_name,quantity,adults,children,adult_capacity,child_capacity,total_capacity FROM booking_line WHERE booking_id=?",
      )
      .bind(id, id, original),
    db
      .prepare(
        "INSERT INTO booking_night SELECT n.line_id||?,n.night,n.unit_cents FROM booking_night n JOIN booking_line l ON l.id=n.line_id WHERE l.booking_id=?",
      )
      .bind(id, original),
    db
      .prepare(
        "INSERT INTO booking_charge SELECT ?,code,label,amount_cents FROM booking_charge WHERE booking_id=?",
      )
      .bind(id, original),
    db.prepare("UPDATE booking SET status='pending' WHERE id=?").bind(id),
  ]);
  return id;
}
test("24-hour lead boundary uses Cambodia local check-in; client deadlines are ignored", async () => {
  const p = await database();
  try {
    const db = p.db,
      { input } = await catalog(db);
    // Tomorrow at the local clock minute just before/after now: one minute either
    // side of the 24-hour boundary, including a midnight local date rollover.
    const now = Date.now(),
      localTomorrow = new Date(now + 86400000 + 7 * 3600000)
        .toISOString()
        .slice(0, 10);
    const checkout = new Date(Date.parse(localTomorrow) + 86400000)
      .toISOString()
      .slice(0, 10);
    await db.batch([
      db
        .prepare(
          "INSERT INTO inventory_night(room_type_id,night,capacity) VALUES ('r',?,2)",
        )
        .bind(localTomorrow),
      db
        .prepare(
          "INSERT INTO nightly_rate(room_type_id,night,unit_cents) VALUES ('r',?,3500)",
        )
        .bind(localTomorrow),
    ]);
    for (const delta of [-120000, 120000]) {
      const instant = new Date(
        now + 86400000 + delta + 7 * 3600000,
      ).toISOString();
      const day = instant.slice(0, 10),
        time = instant.slice(11, 16);
      // At midnight the +/- minutes may fall on adjacent days; provision that exact date.
      await db.batch([
        db
          .prepare(
            "INSERT OR IGNORE INTO inventory_night(room_type_id,night,capacity) VALUES ('r',?,2)",
          )
          .bind(day),
        db
          .prepare(
            "INSERT OR IGNORE INTO nightly_rate(room_type_id,night,unit_cents) VALUES ('r',?,3500)",
          )
          .bind(day),
        db
          .prepare("UPDATE property SET checkin_time=? WHERE id='p'")
          .bind(time),
      ]);
      const selected = {
        ...input,
        checkin: day,
        checkout: new Date(Date.parse(day) + 86400000)
          .toISOString()
          .slice(0, 10),
      };
      const q = await quote(db, guest, selected);
      if (delta < 0)
        await assert.rejects(
          submit(db, guest, "too-late", selected, q.hash),
          /conflict/,
        );
      else {
        const r = await submit(
          db,
          guest,
          "allowed",
          { ...selected, expiresAt: 1, totalCents: 1 },
          q.hash,
        );
        const stored = await db
          .prepare(
            "SELECT submitted_at,expires_at,checkin_at,total_cents FROM booking WHERE id=?",
          )
          .bind(r.id)
          .first<{
            submitted_at: number;
            expires_at: number;
            checkin_at: number;
            total_cents: number;
          }>();
        assert.ok(stored);
        assert.equal(stored.expires_at - stored.submitted_at, 43200);
        assert.ok(stored.checkin_at - stored.submitted_at >= 86400);
        assert.equal(stored.total_cents, 4000);
      }
    }
  } finally {
    await p.dispose();
  }
});
test("accept/decline reject exactly-at-expiry even before cron; overlapping expiry runs write once without stock", async () => {
  const p = await database();
  try {
    const db = p.db,
      { input } = await catalog(db),
      original = await request(db, input);
    const expired = await historical(db, original.id, "unixepoch()");
    await assert.rejects(
      transition(db, owner, "late-accept", expired, "accept"),
      /conflict/,
    );
    await assert.rejects(
      transition(db, owner, "late-decline", expired, "decline"),
      /conflict/,
    );
    await Promise.all([expireDue(db), expireDue(db)]);
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
    assert.equal(
      await scalar(
        db,
        "SELECT count(*) n FROM notification_outbox o JOIN booking_event e ON e.id=o.event_id WHERE e.booking_id=? AND e.kind='expired'",
        expired,
      ),
      2,
    );
    const live = await historical(db, original.id, "unixepoch()+3600");
    await transition(db, owner, "in-time", live, "accept");
  } finally {
    await p.dispose();
  }
});
test("a rate revision changing after quote calculation aborts the atomic request with no partial snapshot", async () => {
  const p = await database();
  try {
    const db = p.db,
      { input } = await catalog(db),
      q = await quote(db, guest, input);
    let first = true;
    const racing = new Proxy(db, {
      get(target, prop) {
        if (prop === "batch")
          return async (...args: Parameters<D1Database["batch"]>) => {
            if (first) {
              first = false;
              await target
                .prepare(
                  "UPDATE nightly_rate SET unit_cents=4000 WHERE room_type_id='r'",
                )
                .run();
            }
            return target.batch(...args);
          };
        const v = Reflect.get(target, prop);
        return typeof v === "function" ? v.bind(target) : v;
      },
    });
    await assert.rejects(submit(racing, guest, "stale-race", input, q.hash));
    assert.equal(await scalar(db, "SELECT count(*) n FROM booking"), 0);
    assert.equal(await scalar(db, "SELECT count(*) n FROM operation"), 0);
  } finally {
    await p.dispose();
  }
});
