import { test } from "vitest";
import assert from "node:assert/strict";
import { env } from "cloudflare:workers";
import {database, catalog, owner, guest, other, unverified, scalar, migrate, request} from "./support";
import {prepareExternalReview, externalReview, applyExternalReview} from "@root-of-cambodia/backend/external-bookings";
import {externalReviews} from "@root-of-cambodia/backend/external-booking-queries";
import {quote} from "@root-of-cambodia/backend/quotes";
import {submit, transition} from "@root-of-cambodia/backend/bookings";
const confirmed = {confirmed: true};
const selection = (input: {checkin: string; checkout: string; lines: unknown[]}) =>
  ({checkin: input.checkin, checkout: input.checkout, lines: input.lines});
test("external review reserves nothing; explicit confirmation is anonymous, exact, atomic and replayable after cancellation/catalog changes", async () => {
  const p = await database(); try {
    const db = p.db, {input} = await catalog(db), id = crypto.randomUUID();
    const body = selection(input);
    await prepareExternalReview(db, owner, "p", id, body);
    await prepareExternalReview(db, owner, "p", id, body);
    assert.equal(await scalar(db, "SELECT count(*) n FROM booking"), 0);
    assert.equal(await scalar(db, "SELECT sum(reserved) n FROM inventory_night"), 0);
    const review = await externalReview(db, owner, "p", id);
    assert.equal(review.receipt, null);
    assert.deepEqual(Object.keys(review.preview).sort(), ["charges","checkinAt","checkoutAt","currency","input","lines","policyText","policyVersion","propertyName","totalCents"]);
    await assert.rejects(applyExternalReview(db, owner, "p", id, {confirmed: false}), /confirmation_required/);
    const [a,b] = await Promise.all([applyExternalReview(db, owner, "p", id, confirmed), applyExternalReview(db, owner, "p", id, confirmed)]);
    assert.deepEqual(a,b); assert.equal(a.status, "confirmed");
    const booked = await db.prepare("SELECT guest_id,guest_email,guest_name,total_cents,source FROM booking WHERE id=?").bind(a.id).first();
    assert.deepEqual(booked, {guest_id: null, guest_email: null, guest_name: "External reservation", total_cents: review.preview.totalCents, source: "external"});
    assert.equal(await scalar(db, "SELECT sum(reserved) n FROM inventory_night"), 2);
    assert.equal((await externalReviews(db, owner, "p")).length, 0);
    await transition(db, owner, "cancel-external", a.id, "cancel_owner", "Fixture correction");
    await db.prepare("UPDATE nightly_rate SET unit_cents=9900").run();
    assert.deepEqual(await applyExternalReview(db, owner, "p", id, confirmed), a);
    assert.deepEqual((await externalReview(db, owner, "p", id)).receipt, a);
    assert.equal(await scalar(db, "SELECT count(*) n FROM booking"), 1);
    assert.equal(await scalar(db, "SELECT sum(reserved) n FROM inventory_night"), 0);
  } finally {await p.dispose();}
});
test("external saved reviews and receipts require current verified owner and exact property; input cannot add guest or pricing policy", async () => {
  const p = await database(); try {
    const db=p.db, {input}=await catalog(db), id=crypto.randomUUID(), body=selection(input);
    await prepareExternalReview(db,owner,"p",id,body);
    for (const actor of [guest,other]) {
      await assert.rejects(externalReview(db,actor,"p",id),/not_found/);
      await assert.rejects(applyExternalReview(db,actor,"p",id,confirmed),/not_found/);
    }
    await assert.rejects(externalReview(db,unverified,"p",id),/verified_session_required/);
    await assert.rejects(externalReview(db,owner,"other",id),/not_found/);
    for (const extra of [{amountCents:1},{guestEmail:"private@example.invalid"},{infants:0},{termsVersion:"invented"}])
      await assert.rejects(prepareExternalReview(db,owner,"p",crypto.randomUUID(),{...body,...extra}),/invalid_request/);
    await assert.rejects(prepareExternalReview(db,owner,"p",id,{...body,lines:[{...input.lines[0],quantity:2}]}),/idempotency_conflict/);
    await applyExternalReview(db,owner,"p",id,confirmed);
    await db.prepare("UPDATE property SET owner_id='other' WHERE id='p'").run();
    await assert.rejects(externalReview(db,owner,"p",id),/not_found/);
    await assert.rejects(applyExternalReview(db,owner,"p",id,confirmed),/not_found/);
  } finally {await p.dispose();}
});
test("competing saved external reviews reserve the last room once and stale prices or reserved-key bypasses cannot create a second booking", async () => {
  const p=await database(); try {
    const db=p.db, {input}=await catalog(db,1), ids=[crypto.randomUUID(),crypto.randomUUID()];
    for (const id of ids) await prepareExternalReview(db,owner,"p",id,selection(input));
    const results=await Promise.allSettled(ids.map(id=>applyExternalReview(db,owner,"p",id,confirmed)));
    assert.equal(results.filter(r=>r.status==="fulfilled").length,1);
    assert.equal(await scalar(db,"SELECT count(*) n FROM booking"),1);
    assert.equal(await scalar(db,"SELECT sum(reserved) n FROM inventory_night"),2);
  } finally {await p.dispose();}
  const q=await database(); try {
    const db=q.db, {input}=await catalog(db), id=crypto.randomUUID();
    await prepareExternalReview(db,owner,"p",id,selection(input));
    await db.prepare("UPDATE nightly_rate SET unit_cents=3600").run();
    await assert.rejects(applyExternalReview(db,owner,"p",id,confirmed),/quote_changed/);
    const changed=await quote(db,owner,input,"external");
    await assert.rejects(submit(db,owner,"external-request:"+id,input,changed.hash,"external"),/booking_conflict/);
    const online=await quote(db,owner,input);
    await assert.rejects(submit(db,owner,"external-request:"+id,input,online.hash),/booking_conflict/);
    assert.equal(await scalar(db,"SELECT count(*) n FROM booking"),0);
    assert.equal(await scalar(db,"SELECT count(*) n FROM operation"),0);
  } finally {await q.dispose();}
});
test("multi-room external allocation rolls back every night/history/receipt on later-night, permission and outbox failure", async () => {
  for (const failure of ["later-night","owner","verification","outbox"]) {
    const p=await database(); try {
      const db=p.db, {input,days}=await catalog(db), id=crypto.randomUUID();
      const body={...selection(input),lines:[...input.lines,{...input.lines[0],roomId:"r2"}]};
      await prepareExternalReview(db,owner,"p",id,body);
      if (failure==="later-night") await db.prepare("UPDATE inventory_night SET capacity=0 WHERE room_type_id='r2' AND night=?").bind(days[1]).run();
      if (failure==="outbox") await db.prepare("CREATE TRIGGER fail_external_outbox BEFORE INSERT ON notification_outbox BEGIN SELECT RAISE(ABORT,'invalid_fixture_outbox'); END").run();
      let once=true;
      const racing=new Proxy(db,{get(target,prop) {
        if(prop==="batch") return async (...args: Parameters<D1Database["batch"]>) => {
          if(once) {once=false;
            if(failure==="owner") await target.prepare("UPDATE property SET owner_id='other' WHERE id='p'").run();
            if(failure==="verification") await target.prepare("UPDATE user SET emailVerified=0 WHERE id='owner'").run();
          }
          return target.batch(...args);
        };
        const value=Reflect.get(target,prop);return typeof value==="function"?value.bind(target):value;
      }});
      await assert.rejects(applyExternalReview(racing,owner,"p",id,confirmed),/inventory_unavailable|booking_conflict/);
      for(const table of ["booking","operation","allocation","booking_event","notification_outbox"])
        assert.equal(await scalar(db,"SELECT count(*) n FROM "+table),0,table);
      assert.equal(await scalar(db,"SELECT sum(reserved) n FROM inventory_night"),0);
      assert.equal(await scalar(db,"SELECT count(*) n FROM external_booking_attempt"),1);
    } finally {await p.dispose();}
  }
});
test("external review insertion rechecks ownership, is immutable and bounded; populated 0016 upgrade preserves every previous booking record", async () => {
  const p=await database({migrate:false});try {
    const db=p.db;
    await migrate(db,env.TEST_MIGRATIONS.filter(m=>m.name<"0017").map(m=>m.name));
    const {input}=await catalog(db); await request(db,input);
    const tables=["booking","booking_line","booking_night","operation","booking_event","allocation","notification_outbox"];
    const snapshot=()=>Promise.all(tables.map(async table=>(await db.prepare("SELECT * FROM "+table+" ORDER BY rowid").all()).results));
    const before=await snapshot();await migrate(db);await migrate(db);
    assert.deepEqual(await snapshot(),before);
    assert.equal(await scalar(db,"SELECT count(*) n FROM external_booking_attempt"),0);
    for(let i=0;i<7;i++)await prepareExternalReview(db,owner,"p",crypto.randomUUID(),selection(input));
    assert.equal((await externalReviews(db,owner,"p")).length,5);
    await assert.rejects(db.prepare("INSERT INTO external_booking_attempt SELECT ?,\'other\',property_id,fingerprint,input_json,quote_hash,preview_json,operation_fingerprint,created_at FROM external_booking_attempt LIMIT 1").bind(crypto.randomUUID()).run(),/invalid_external_review_owner/);
    await assert.rejects(db.prepare("UPDATE external_booking_attempt SET quote_hash='changed'").run(),/immutable_external_review/);
    await assert.rejects(db.prepare("DELETE FROM external_booking_attempt").run(),/retained_external_review/);
    assert.deepEqual((await db.prepare("PRAGMA foreign_key_check").all()).results,[]);
  }finally{await p.dispose();}
});
