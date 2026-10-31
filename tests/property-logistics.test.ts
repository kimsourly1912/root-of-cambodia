import { env } from "cloudflare:workers";
import { test } from "vitest";
import assert from "node:assert/strict";
import { database, migrate, catalog, request, owner, other, unverified, scalar } from "./support";
import { createPropertyDraft } from "@root-of-cambodia/backend/properties";
import { ownerPropertyLogistics } from "@root-of-cambodia/backend/property-logistics";
import { savePropertyLogistics } from "@root-of-cambodia/backend/property-logistics";
import { commitPropertyLogistics } from "../packages/backend/src/features/property-logistics/property-logistics-persistence";
import { readBooking } from "@root-of-cambodia/backend/shared";
import { testTransition as transition } from "./booking-fixtures";
const blank = { latitude: null, longitude: null, contactName: "", contactPhone: "", contactEmail: "", arrivalInstructions: "", revision: null };
const base = { ...blank, latitude: 10.606, longitude: 104.181, contactName: "Reception", contactPhone: "+855 12 345 678", contactEmail: "stay@example.invalid", arrivalInstructions: "ផ្លូវភូមិ\nTurn left at the bridge." };
async function setup(db: D1Database) {
  await catalog(db);
  return (await createPropertyDraft(db, owner, "property", {
    ownerName: "Owner", nameKm: "ផ្ទះ", nameEn: "House", province: "Kampot",
    checkinTime: "14:00", checkoutTime: "11:00", policyText: "Quiet hours.",
  })).id;
}
const save = (db: D1Database, id: string, key: string, fields: Record<string, unknown>) =>
  savePropertyLogistics(db, owner, key, id, fields);
function beforeBatch(db: D1Database, action: () => Promise<unknown>) {
  let first = true;
  return new Proxy(db, {
    get(target, key) {
      if (key === "batch") return async (statements: D1PreparedStatement[]) => {
        if (first) { first = false; await action(); }
        return target.batch(statements);
      };
      const value = Reflect.get(target, key);
      return typeof value === "function" ? value.bind(target) : value;
    },
  });
}
test("private logistics starts absent, trims fields, clears optional details and retains successful receipts after later changes", async () => {
  const p = await database();
  try {
    const db = p.db, id = await setup(db);
    assert.deepEqual(await ownerPropertyLogistics(db, owner, id), blank);
    const receipt = await save(db, id, "first", { ...base, contactName: " Reception ", arrivalInstructions: base.arrivalInstructions + "\n" });
    assert.deepEqual(receipt, { id, status: "updated" });
    assert.deepEqual(await ownerPropertyLogistics(db, owner, id), { ...base, revision: 1 });
    await save(db, id, "clear", { ...blank, revision: 1 });
    assert.deepEqual(await ownerPropertyLogistics(db, owner, id), { ...blank, revision: 2 });
    assert.equal(await scalar(db, "SELECT revision n FROM property WHERE id=?", id), 1);
    await db.prepare("UPDATE place SET publication='review' WHERE id=?").bind(id).run();
    assert.deepEqual(await save(db, id, "first", base), receipt);
    await assert.rejects(save(db, id, "first", { ...base, contactName: "Different" }), /idempotency_conflict/);
    await assert.rejects(save(db, id, "review-write", { ...base, revision: 2 }), /booking_conflict/);
    assert.equal(await scalar(db, "SELECT count(*) n FROM property_logistics_event"), 2);
  } finally { await p.dispose(); }
});
test("logistics reads, writes and replay require current verified ownership", async () => {
  const p = await database();
  try {
    const db = p.db, id = await setup(db);
    await save(db, id, "first", base);
    for (const actor of [other, unverified]) {
      const expected = actor === other ? /not_found/ : /verified_session_required/;
      await assert.rejects(ownerPropertyLogistics(db, actor, id), expected);
      await assert.rejects(savePropertyLogistics(db, actor, "forbidden", id, base), expected);
    }
    await db.prepare("UPDATE user SET emailVerified=0 WHERE id='owner'").run();
    await assert.rejects(save(db, id, "first", base), /verified_session_required/);
    await db.prepare("UPDATE user SET emailVerified=1 WHERE id='owner'").run();
    await db.prepare("UPDATE property SET owner_id='other' WHERE id=?").bind(id).run();
    await assert.rejects(save(db, id, "first", base), /not_found/);
    await assert.rejects(ownerPropertyLogistics(db, owner, id), /not_found/);
  } finally { await p.dispose(); }
});
test("competing absent/versioned logistics saves retain one winner and no losing event or receipt", async () => {
  const p = await database();
  try {
    const db = p.db, id = await setup(db);
    for (const revision of [null, 1]) {
      const outcomes = await Promise.allSettled(["A", "B"].map(contactName =>
        save(db, id, String(revision) + contactName, { ...base, contactName, revision }),
      ));
      assert.equal(outcomes.filter(x => x.status === "fulfilled").length, 1);
    }
    assert.equal((await ownerPropertyLogistics(db, owner, id)).revision, 2);
    await assert.rejects(save(db, id, "stale", { ...base, revision: 1 }), /booking_conflict/);
    assert.equal(await scalar(db, "SELECT count(*) n FROM property_logistics_event"), 2);
    assert.equal(await scalar(db, "SELECT count(*) n FROM operation WHERE kind='property_logistics'"), 2);
  } finally { await p.dispose(); }
});
test("same-key competition and response loss recover one complete logistics save", async () => {
  const p = await database();
  try {
    const db = p.db, id = await setup(db);
    const receipts = await Promise.all([save(db, id, "same", base), save(db, id, "same", base)]);
    assert.deepEqual(receipts[0], receipts[1]);
    let lost = false;
    const flaky = new Proxy(db, {
      get(target, key) {
        if (key === "batch") return async (statements: D1PreparedStatement[]) => {
          const result = await target.batch(statements);
          if (!lost) { lost = true; throw new Error("Response lost after commit"); }
          return result;
        };
        const value = Reflect.get(target, key);
        return typeof value === "function" ? value.bind(target) : value;
      },
    });
    const edit = { ...base, contactName: "Updated", revision: 1 };
    const receipt = await save(flaky, id, "lost", edit);
    assert.deepEqual(await save(db, id, "lost", edit), receipt);
    assert.equal((await ownerPropertyLogistics(db, owner, id)).revision, 2);
    assert.equal(await scalar(db, "SELECT count(*) n FROM property_logistics_event"), 2);
  } finally { await p.dispose(); }
});
test("write-time ownership, verification, publication and expected-absence races roll back the entire save", async () => {
  for (const change of ["owner", "verification", "publication", "version"]) {
    const p = await database();
    try {
      const db = p.db, id = await setup(db);
      const raced = beforeBatch(db, async () => {
        if (change === "version") await save(db, id, "winner", base);
        else {
          const sql = change === "owner" ? "UPDATE property SET owner_id='other' WHERE id=?" :
            change === "verification" ? "UPDATE user SET emailVerified=0 WHERE id=?" :
            "UPDATE place SET publication='review' WHERE id=?";
          await db.prepare(sql).bind(change === "verification" ? owner.id : id).run();
        }
      });
      await assert.rejects(save(raced, id, "loser", base), /booking_conflict/);
      assert.equal(await scalar(db, "SELECT count(*) n FROM operation WHERE key='loser'"), 0);
      assert.equal(await scalar(db, "SELECT count(*) n FROM property_logistics"), change === "version" ? 1 : 0);
      assert.equal(await scalar(db, "SELECT count(*) n FROM property_logistics_event"), change === "version" ? 1 : 0);
    } finally { await p.dispose(); }
  }
});
test("logistics audit failures roll back and database guards protect coordinates, versions and attributable history", async () => {
  const p = await database();
  try {
    const db = p.db, id = await setup(db);
    await assert.rejects(commitPropertyLogistics(db, unverified, "unverified", id, base), /booking_conflict/);
    await db.prepare("CREATE TRIGGER fail_logistics BEFORE INSERT ON property_logistics_event BEGIN SELECT RAISE(ABORT,'invalid_test_history'); END").run();
    await assert.rejects(save(db, id, "recover", base), /booking_conflict/);
    assert.equal((await ownerPropertyLogistics(db, owner, id)).revision, null);
    assert.equal(await scalar(db, "SELECT count(*) n FROM operation WHERE key='recover'"), 0);
    await db.prepare("DROP TRIGGER fail_logistics").run();
    await save(db, id, "recover", base);
    await assert.rejects(db.prepare("UPDATE property_logistics SET contact_name='Undocumented' WHERE property_id=?").bind(id).run(), /invalid_logistics_revision/);
    await assert.rejects(db.prepare("UPDATE property_logistics SET property_id='other',revision=revision+1 WHERE property_id=?").bind(id).run(), /invalid_logistics_revision/);
    for (const patch of [{ latitude: 91 }, { longitude: -181 }, { latitude: null }]) {
      await assert.rejects(commitPropertyLogistics(db, owner, crypto.randomUUID(), id, { ...base, revision: 1, ...patch }), /booking_conflict/);
    }
    assert.equal((await ownerPropertyLogistics(db, owner, id)).revision, 1);
    await assert.rejects(db.prepare("UPDATE property_logistics_event SET actor_id='other'").run(), /immutable_logistics_history/);
    await assert.rejects(db.prepare("DELETE FROM property_logistics_event").run(), /immutable_logistics_history/);
    await assert.rejects(db.prepare("INSERT INTO property_logistics_event VALUES('forged',?,'other',2,unixepoch())").bind(id).run(), /invalid_logistics_actor/);
  } finally { await p.dispose(); }
});
test("logistics validation bounds coordinates/contact/notes and rejects verification, publication and booking-policy fields", async () => {
  const p = await database();
  try {
    const db = p.db, id = await setup(db);
    for (const patch of [
      { latitude: 91 }, { longitude: -181 }, { latitude: "10" }, { latitude: undefined },
      { latitude: Number.NaN }, { longitude: Number.POSITIVE_INFINITY }, { longitude: null },
      { contactName: "x".repeat(201) }, { contactPhone: "x".repeat(101) },
      { contactEmail: "x".repeat(255) }, { contactEmail: "not-an-email" },
      { contactName: "bad\nname" }, { contactPhone: "bad\u0000phone" },
      { arrivalInstructions: "x".repeat(5001) }, { arrivalInstructions: "bad\u0000notes" },
      { revision: 0 }, { revision: undefined }, { ownerId: "other" }, { publication: "published" },
      { phoneVerified: true }, { checkinTime: "12:00" }, { policyText: "New policy" },
    ]) await assert.rejects(save(db, id, crypto.randomUUID(), { ...base, ...patch }), /invalid_property_logistics/);
    assert.equal(await scalar(db, "SELECT count(*) n FROM property_logistics_event"), 0);
    await save(db, id, "boundary", { ...base, latitude: -90, longitude: 180 });
    await save(db, id, "zero", { ...base, latitude: 0, longitude: 0, revision: 1 });
    assert.equal((await ownerPropertyLogistics(db, owner, id)).latitude, 0);
  } finally { await p.dispose(); }
});
test("private logistics does not change or disclose through booking snapshots, prices, stock or delivery events", async () => {
  const p = await database();
  try {
    const db = p.db, { input } = await catalog(db, 4);
    const booking = await request(db, input);
    await transition(db, owner, "accept", booking.id, "accept");
    const before = await readBooking(db, { id: "guest" }, booking.id);
    const property = await db.prepare("SELECT * FROM property WHERE id='p'").first();
    const stock = (await db.prepare("SELECT * FROM inventory_night ORDER BY room_type_id,night").all()).results;
    const outbox = await scalar(db, "SELECT count(*) n FROM notification_outbox");
    await db.prepare("UPDATE place SET publication='draft' WHERE id='p'").run();
    await save(db, "p", "logistics", {...base, revision:(await ownerPropertyLogistics(db,owner,"p")).revision});
    assert.deepEqual(await readBooking(db, { id: "guest" }, booking.id), before);
    assert.deepEqual(await db.prepare("SELECT * FROM property WHERE id='p'").first(), property);
    assert.deepEqual((await db.prepare("SELECT * FROM inventory_night ORDER BY room_type_id,night").all()).results, stock);
    assert.equal(await scalar(db, "SELECT count(*) n FROM notification_outbox"), outbox);
    await assert.rejects(transition(db, owner, "arrival", booking.id, "check_in"), /booking_conflict/);
  } finally { await p.dispose(); }
});
test("populated upgrade adds empty logistics tables while retaining existing records and retry receipts", async () => {
  const p = await database({ migrate: false });
  try {
    const db = p.db;
    await migrate(db, env.TEST_MIGRATIONS.filter(m => m.name !== "0010_property_logistics.sql").map(m => m.name));
    const id = await setup(db);
    const dates = (await db.prepare("SELECT night FROM inventory_night WHERE room_type_id='r' ORDER BY night").all<{ night: string }>()).results;
    const input = {
      propertyId: "p", checkin: dates[0].night,
      checkout: new Date(Date.parse(dates.at(-1)!.night) + 86400000).toISOString().slice(0, 10),
      termsVersion: "terms-v1",
      lines: [{ roomId: "r", quantity: 1, adults: 1, children: 0 }],
    };
    const receipt = await request(db, input, "upgrade-booking");
    const tables = (await db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' AND substr(name,1,1)!='_' AND name!='d1_migrations' ORDER BY name").all<{name:string}>()).results;
    const snapshot = async () => {
      const result: Record<string, unknown> = {};
      for (const {name} of tables) result[name] = (await db.prepare('SELECT * FROM "'+name.replaceAll('"','""')+'" ORDER BY rowid').all()).results;
      return result;
    };
    const before = await snapshot();
    await migrate(db);
    assert.deepEqual(await snapshot(), before);
    assert.equal(await scalar(db, "SELECT count(*) n FROM property_logistics"), 0);
    assert.equal(await scalar(db, "SELECT count(*) n FROM property_logistics_event"), 0);
    assert.deepEqual(await request(db, input, "upgrade-booking"), receipt);
    await save(db, id, "after-upgrade", base);
    assert.equal((await ownerPropertyLogistics(db, owner, id)).revision, 1);
  } finally { await p.dispose(); }
});
