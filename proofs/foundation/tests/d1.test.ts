import assert from "node:assert/strict";
import { test } from "node:test";
import { randomUUID } from "node:crypto";
import { drizzle } from "drizzle-orm/d1";
import { sql } from "drizzle-orm";
import { accept,cancel } from "../src/booking";
import { database,migrate,fixture } from "./support";
const actor={id:"owner",emailVerified:true};
async function setup(opts:Parameters<typeof fixture>[1]={}) {
  const proxy=await database(randomUUID());
  await migrate(proxy.env.DB); await fixture(proxy.env.DB,opts); return proxy;
}
test("Drizzle D1 driver observes the same committed reservation",async()=>{
  const p=await setup(); try {
    await accept(p.env.DB,"a",actor);
    const row=await drizzle(p.env.DB).get<{reserved:number}>(sql`SELECT sum(reserved) AS reserved FROM inventory_night`);
    assert.equal(row.reserved,2);
  } finally {await p.dispose();}
});
test("simultaneous owners' actions cannot sell the last room twice",async()=>{
  const p=await setup(); try {
    const results=await Promise.allSettled([accept(p.env.DB,"a",actor),accept(p.env.DB,"b",actor)]);
    assert.equal(results.filter(r=>r.status==="fulfilled").length,1);
    const rows=await p.env.DB.prepare("SELECT reserved FROM inventory_night").all();
    assert.deepEqual(rows.results.map((r:any)=>r.reserved),[1,1]);
    assert.equal((await p.env.DB.prepare("SELECT count(*) n FROM booking WHERE status='confirmed'").first<any>()).n,1);
    assert.equal((await p.env.DB.prepare("SELECT count(*) n FROM notification_outbox").first<any>()).n,1);
  } finally {await p.dispose();}
});
test("a capacity conflict rolls back prior batch statements and every side effect",async()=>{
  const p=await setup(); try {
    await p.env.DB.prepare("UPDATE inventory_night SET blocked=capacity WHERE night=(SELECT max(night) FROM inventory_night)").run();
    await assert.rejects(p.env.DB.batch([
      p.env.DB.prepare("INSERT INTO batch_probe VALUES ('before')"),
      p.env.DB.prepare("UPDATE booking SET status='confirmed' WHERE id='a'")
    ]));
    assert.equal((await p.env.DB.prepare("SELECT count(*) n FROM batch_probe").first<any>()).n,0);
    assert.equal((await p.env.DB.prepare("SELECT sum(reserved) n FROM inventory_night").first<any>()).n,0);
    assert.equal((await p.env.DB.prepare("SELECT status FROM booking WHERE id='a'").first<any>()).status,"pending");
    for(const table of ["allocation","booking_event","notification_outbox"])
      assert.equal((await p.env.DB.prepare("SELECT count(*) n FROM "+table).first<any>()).n,0);
  } finally {await p.dispose();}
});
test("a missing occupied night cannot produce a partial reservation",async()=>{
  const p=await setup({secondNight:false}); try {
    await assert.rejects(accept(p.env.DB,"a",actor));
    assert.equal((await p.env.DB.prepare("SELECT sum(reserved) n FROM inventory_night").first<any>()).n,0);
    assert.equal((await p.env.DB.prepare("SELECT count(*) n FROM notification_outbox").first<any>()).n,0);
  } finally {await p.dispose();}
});
test("repeated acceptance and cancellation allocate and release exactly once",async()=>{
  const p=await setup(); try {
    await accept(p.env.DB,"a",actor); assert.equal((await accept(p.env.DB,"a",actor)).repeated,true);
    assert.equal((await cancel(p.env.DB,"a",actor,{as:"owner",reason:"Property closed for repairs"})).changed,true);
    assert.equal((await cancel(p.env.DB,"a",actor,{as:"owner",reason:"Property closed for repairs"})).changed,false);
    const audit=await p.env.DB.prepare("SELECT cancelled_by,cancellation_role,cancellation_reason FROM booking WHERE id='a'").first();
    assert.deepEqual(audit,{cancelled_by:"owner",cancellation_role:"owner",cancellation_reason:"Property closed for repairs"});
    await assert.rejects(p.env.DB.prepare("UPDATE booking SET cancellation_reason='changed' WHERE id='a'").run(),/immutable_cancellation/);
    assert.equal((await p.env.DB.prepare("SELECT sum(reserved) n FROM inventory_night").first<any>()).n,0);
    assert.equal((await p.env.DB.prepare("SELECT count(*) n FROM notification_outbox").first<any>()).n,2);
  } finally {await p.dispose();}
});
test("expiry and owner/email boundaries are enforced without writes",async()=>{
  const p=await setup({expires:Math.floor(Date.now()/1000)-1}); try {
    await assert.rejects(accept(p.env.DB,"a",actor));
    await assert.rejects(accept(p.env.DB,"b",{id:"other-owner",emailVerified:true}));
    await assert.rejects(accept(p.env.DB,"b",{id:"owner",emailVerified:false}));
    assert.equal((await p.env.DB.prepare("SELECT sum(reserved) n FROM inventory_night").first<any>()).n,0);
    assert.equal((await p.env.DB.prepare("SELECT count(*) n FROM notification_outbox").first<any>()).n,0);
  } finally {await p.dispose();}
});
test("cancel a pending request without adding inventory",async()=>{
  const p=await setup(); try {
    await cancel(p.env.DB,"a",{id:"guest-a",emailVerified:true},{as:"guest"});
    assert.equal((await p.env.DB.prepare("SELECT sum(reserved) n FROM inventory_night").first<any>()).n,0);
  } finally {await p.dispose();}
});
test("submitted quote headers and room-night rows cannot be rewritten",async()=>{
  const p=await setup(); try {
    for(const statement of [
      "UPDATE booking SET total_cents=1 WHERE id='a'",
      "UPDATE requested_night SET quantity=2 WHERE booking_id='a'",
      "DELETE FROM requested_night WHERE booking_id='a'",
      "INSERT INTO requested_night VALUES ('a','other-room','2030-01-01',1,3500)",
      "UPDATE booking SET snapshot_sealed=0 WHERE id='a'"
    ]) await assert.rejects(p.env.DB.prepare(statement).run());
  } finally {await p.dispose();}
});
test("terminal bookings cannot reopen or bypass confirmation through insert",async()=>{
  const p=await setup(); try {
    await cancel(p.env.DB,"a",{id:"guest-a",emailVerified:true},{as:"guest"});
    await assert.rejects(p.env.DB.prepare("UPDATE booking SET status='pending' WHERE id='a'").run());
    await assert.rejects(p.env.DB.prepare(`
      INSERT INTO booking(id,property_id,guest_id,status,expires_at,checkin_at,checkin_date,checkout_date,expected_nights,total_cents)
      SELECT 'c',property_id,guest_id,'confirmed',expires_at,checkin_at,checkin_date,checkout_date,expected_nights,total_cents
      FROM booking WHERE id='b'
    `).run(),/invalid_initial_state/);
  } finally {await p.dispose();}
});
test("room counts and money reject fractional values",async()=>{
  const p=await setup(); try {
    await assert.rejects(p.env.DB.prepare("UPDATE inventory_night SET capacity=2.5").run());
    await assert.rejects(p.env.DB.prepare("UPDATE inventory_night SET blocked=0.5").run());
    await assert.rejects(p.env.DB.prepare(`
      INSERT INTO booking(id,property_id,guest_id,expires_at,checkin_at,checkin_date,checkout_date,expected_nights,total_cents)
      SELECT 'c',property_id,guest_id,expires_at,checkin_at,checkin_date,checkout_date,expected_nights,3500.5
      FROM booking WHERE id='b'
    `).run(),/CHECK constraint failed/);
  } finally {await p.dispose();}
});
test("owner cancellation requires a nonblank reason",async()=>{
  const p=await setup(); try {
    await assert.rejects(cancel(p.env.DB,"a",actor,{as:"owner",reason:" \n\t "}),/owner_reason_required/);
    assert.equal((await p.env.DB.prepare("SELECT status FROM booking WHERE id='a'").first<any>()).status,"pending");
  } finally {await p.dispose();}
});
test("capacity reductions and blocks cannot displace confirmed allocations",async()=>{
  const p=await setup(); try {
    await accept(p.env.DB,"a",actor);
    await assert.rejects(p.env.DB.prepare("UPDATE inventory_night SET capacity=0").run());
    await assert.rejects(p.env.DB.prepare("UPDATE inventory_night SET blocked=1").run());
    assert.equal((await p.env.DB.prepare("SELECT sum(reserved) n FROM inventory_night").first<any>()).n,2);
  } finally {await p.dispose();}
});
test("a gap in occupied dates aborts every confirmation side effect",async()=>{
  const p=await setup({gap:true}); try {
    await assert.rejects(accept(p.env.DB,"a",actor),/invalid_dates/);
    assert.equal((await p.env.DB.prepare("SELECT sum(reserved) n FROM inventory_night").first<any>()).n,0);
    for(const table of ["allocation","booking_event","notification_outbox"])
      assert.equal((await p.env.DB.prepare("SELECT count(*) n FROM "+table).first<any>()).n,0);
  } finally {await p.dispose();}
});
test("checkout is excluded and the price uses all occupied nights",async()=>{
  const p=await setup(); try {
    await accept(p.env.DB,"a",actor);
    const booking=await p.env.DB.prepare("SELECT checkout_date,total_cents FROM booking WHERE id='a'").first<any>();
    const allocated=await p.env.DB.prepare("SELECT night FROM allocation WHERE booking_id='a' ORDER BY night").all<{night:string}>();
    assert.equal(allocated.results.length,2);
    assert.ok(allocated.results.every(n=>n.night<booking.checkout_date));
    assert.equal(booking.total_cents,7000);
  } finally {await p.dispose();}
});
test("a total inconsistent with the submitted nightly quote cannot confirm",async()=>{
  const p=await setup({total:6999}); try {
    await assert.rejects(accept(p.env.DB,"a",actor),/invalid_total/);
    assert.equal((await p.env.DB.prepare("SELECT sum(reserved) n FROM inventory_night").first<any>()).n,0);
    assert.equal((await p.env.DB.prepare("SELECT count(*) n FROM notification_outbox").first<any>()).n,0);
  } finally {await p.dispose();}
});
test("incomplete construction cannot be accepted before the snapshot is sealed",async()=>{
  const p=await setup({unsealed:true}); try {
    await assert.rejects(accept(p.env.DB,"a",actor),/invalid_snapshot/);
    assert.equal((await p.env.DB.prepare("SELECT count(*) n FROM allocation").first<any>()).n,0);
  } finally {await p.dispose();}
});
test("noncanonical calendar dates are rejected",async()=>{
  const p=await setup(); try {
    for(const day of ['2028-02-30','2028-2-01','not-a-date'])
      await assert.rejects(p.env.DB.prepare("INSERT INTO inventory_night VALUES ('room',?,1,0,0)").bind(day).run(),/CHECK constraint failed/);
  } finally {await p.dispose();}
});
test("cancellation role never grants access to someone else's booking",async()=>{
  const p=await setup(); try {
    assert.equal((await cancel(p.env.DB,"a",{id:"guest-b",emailVerified:true},{as:"guest"})).changed,false);
    assert.equal((await cancel(p.env.DB,"a",{id:"other-owner",emailVerified:true},{as:"owner",reason:"test"})).changed,false);
    assert.equal((await p.env.DB.prepare("SELECT count(*) n FROM booking_event").first<any>()).n,0);
  } finally {await p.dispose();}
});
