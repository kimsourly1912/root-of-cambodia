import { test } from "vitest";
import assert from "node:assert/strict";
import { env } from "cloudflare:workers";
import { database, migrate, catalog, request, owner, other, guest, unverified } from "./support";
import { ownerBookings, ownerBookingStatuses } from "@root-of-cambodia/backend/owner-bookings";
import { quote } from "@root-of-cambodia/backend/quotes";
import { submit, transition } from "@root-of-cambodia/backend/bookings";
import { atScheduledArrival } from "./stay-fixtures";

test("owner status filters page the full collection without skipped equal-time rows or read side effects", async () => {
  const p = await database();
  try {
    const db = p.db, {input} = await catalog(db, 10);
    const expected = new Map<string, string>();
    for (let i = 0; i < 25; i++) expected.set((await request(db, input)).id, "pending");
    for (const status of ["declined", "cancelled"] as const) {
      const b = await request(db, input);
      await transition(db, owner, crypto.randomUUID(), b.id,
        status === "declined" ? "decline" : "cancel_owner", "Fixture correction");
      expected.set(b.id, status);
    }
    for (const status of ["confirmed", "checked_in", "completed"] as const) {
      const q = await quote(db, owner, input, "external");
      const b = await submit(db, owner, crypto.randomUUID(), input, q.hash, "external");
      if (status !== "confirmed") {
        await atScheduledArrival(db, b.id);
        await transition(db, owner, crypto.randomUUID(), b.id, "check_in");
      }
      if (status === "completed") await transition(db, owner, crypto.randomUUID(), b.id, "complete");
      expected.set(b.id, status);
    }
    const foreignInput = {...input, propertyId: "other", lines: [{...input.lines[0], roomId: "other-r"}]};
    const foreign = await request(db, foreignInput);
    const before = await businessSnapshot(db);
    const all: string[] = [];
    let cursor: string | undefined;
    do {
      const page = await ownerBookings(db, owner, "p", cursor);
      assert.ok(page.items.length <= 20);
      all.push(...page.items.map(b => b.id));
      cursor = page.nextCursor ?? undefined;
    } while (cursor);
    const ordered = (await db.prepare("SELECT id,submitted_at FROM booking WHERE property_id='p'").all<{id: string; submitted_at: number}>()).results
      .sort((a, b) => b.submitted_at - a.submitted_at || (a.id < b.id ? 1 : a.id > b.id ? -1 : 0));
    assert.deepEqual(all, ordered.map(b => b.id));
    assert.equal(all.length, expected.size);
    assert.equal(new Set(all).size, expected.size);
    assert.ok(!all.includes(foreign.id));
    assert.deepEqual(new Set(all), new Set(expected.keys()));
    for (const status of ownerBookingStatuses) {
      const ids: string[] = [];
      cursor = undefined;
      do {
        const page = await ownerBookings(db, owner, "p", cursor, status);
        assert.ok(page.items.every(b => b.status === status));
        ids.push(...page.items.map(b => b.id));
        cursor = page.nextCursor ?? undefined;
      } while (cursor);
      assert.deepEqual(ids, all.filter(id => expected.get(id) === status));
    }
    const pending = await ownerBookings(db, owner, "p", undefined, "pending");
    assert.equal(pending.items.length, 20);
    assert.ok(pending.nextCursor);
    assert.equal((await ownerBookings(db, owner, "p", pending.nextCursor, "pending")).items.length, 5);
    assert.deepEqual(await ownerBookings(db, owner, "p", undefined, "all"), await ownerBookings(db, owner, "p"));
    assert.deepEqual(await businessSnapshot(db), before);
    await db.prepare("UPDATE place SET publication='paused' WHERE id='p'").run();
    assert.equal((await ownerBookings(db, owner, "p", undefined, "confirmed")).items.length, 1);
  } finally { await p.dispose(); }
});

test("filters reject malformed input and require the current verified property owner", async () => {
  const p = await database();
  try {
    const db = p.db, {input} = await catalog(db);
    await request(db, input);
    for (const status of ["", "building", "no_show", "PENDING", "pending' OR 1=1 --", ["pending"], null, 1])
      await assert.rejects(ownerBookings(db, owner, "p", undefined, status), /invalid_request/);
    for (const cursor of [["1:id"], "not-a-cursor", "1:bad/id"])
      await assert.rejects(ownerBookings(db, owner, "p", cursor, "pending"), /invalid_request/);
    for (const actor of [other, guest])
      await assert.rejects(ownerBookings(db, actor, "p", undefined, "pending"), /not_found/);
    await assert.rejects(ownerBookings(db, unverified, "p", undefined, "pending"), /verified_session_required/);
    await assert.rejects(ownerBookings(db, owner, "missing", undefined, "pending"), /not_found/);
    await db.prepare("UPDATE user SET emailVerified=0 WHERE id='owner'").run();
    await assert.rejects(ownerBookings(db, owner, "p", undefined, "pending"), /verified_session_required/);
    await db.prepare("UPDATE user SET emailVerified=1 WHERE id='owner'").run();
    await db.prepare("UPDATE property SET owner_id='other' WHERE id='p'").run();
    await assert.rejects(ownerBookings(db, owner, "p", undefined, "pending"), /not_found/);
    assert.equal((await ownerBookings(db, other, "p", undefined, "pending")).items.length, 1);
  } finally { await p.dispose(); }
});

async function businessSnapshot(db: D1Database) {
  const tables = (await db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' AND name NOT LIKE '\\_%' ESCAPE '\\' AND name!='d1_migrations' ORDER BY name").all<{name: string}>()).results;
  return Promise.all(tables.map(async ({name}) => ({name,
    rows: (await db.prepare('SELECT * FROM "' + name.replaceAll('"', '""') + '" ORDER BY rowid').all()).results})));
}

test("0018 preserves populated 0017 data and actual first/next-page owner queries use ordered indexes", async () => {
  const p = await database({migrate: false});
  try {
    const db = p.db;
    await migrate(db, env.TEST_MIGRATIONS.filter(m => m.name < "0018").map(m => m.name));
    const {input} = await catalog(db);
    const b = await request(db, input, "retained-filter-request");
    const before = await businessSnapshot(db);
    const through0018=env.TEST_MIGRATIONS.filter(m=>m.name<"0019").map(m=>m.name);
    await migrate(db,through0018); await migrate(db,through0018);
    assert.deepEqual(await businessSnapshot(db), before);
    assert.deepEqual(await request(db, input, "retained-filter-request"), b);
    let sql = "", values: unknown[] = [];
    const recording = new Proxy(db, {get(target, prop) {
      if (prop === "prepare") return (text: string) => {
        const stmt = target.prepare(text);
        if (!text.startsWith("SELECT b.id,")) return stmt;
        sql = text;
        return new Proxy(stmt, {get(statement, key) {
          if (key === "bind") return (...args: unknown[]) => { values = args; return statement.bind(...args); };
          const value = Reflect.get(statement, key);
          return typeof value === "function" ? value.bind(statement) : value;
        }});
      };
      const value = Reflect.get(target, prop);
      return typeof value === "function" ? value.bind(target) : value;
    }});
    const row = (await ownerBookings(db, owner, "p")).items[0];
    for (const status of [undefined, "pending"]) for (const cursor of [undefined, row.submittedAt + ":" + row.id]) {
      await ownerBookings(recording, owner, "p", cursor, status);
      const plan = (await db.prepare("EXPLAIN QUERY PLAN " + sql).bind(...values).all<{detail: string}>()).results.map(r => r.detail).join("\n");
      assert.match(plan, new RegExp(status ? "booking_property_status_submitted" : "booking_property_submitted"));
      assert.doesNotMatch(plan, /USE TEMP B-TREE|SCAN b\b/);
    }
    assert.deepEqual((await db.prepare("PRAGMA foreign_key_check").all()).results, []);
  } finally { await p.dispose(); }
});
