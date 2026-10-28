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
    assert.equal((await cancel(p.env.DB,"a",actor)).changed,true);
    assert.equal((await cancel(p.env.DB,"a",actor)).changed,false);
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
    await cancel(p.env.DB,"a",{id:"guest-a",emailVerified:true});
    assert.equal((await p.env.DB.prepare("SELECT sum(reserved) n FROM inventory_night").first<any>()).n,0);
  } finally {await p.dispose();}
});
