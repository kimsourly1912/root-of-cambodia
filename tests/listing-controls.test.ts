import { test } from "vitest";
import assert from "node:assert/strict";
import { env } from "cloudflare:workers";
import { database,migrate,owner,other,guest,unverified,scalar,request } from "./support";
import { listingFixture,listingBody,beforeListingBatch,listingSnapshot } from "./listing-fixtures";
import { listingControls } from "@root-of-cambodia/backend/listing-controls";
import { changeListing } from "@root-of-cambodia/backend/listing-controls";
import { browseStays,publicStay,readPublicPhoto } from "@root-of-cambodia/backend/catalog";
import { quote } from "@root-of-cambodia/backend/quotes";
import { submit,transition } from "@root-of-cambodia/backend/bookings";
import { readBooking } from "@root-of-cambodia/backend/shared";
test("owner pause/resume is atomic, exact-retry safe and leaves existing bookings/stock/review snapshots unchanged",async()=>{
  const p=await database();try{
    const db=p.db,f=await listingFixture(db),pending=await request(db,f.input);
    const q=await quote(db,owner,f.input,"external");
    const booked=await submit(db,owner,"visibility-external",f.input,q.hash,"external");
    const initial=await listingSnapshot(db),pause=await listingBody(db,f.id,"pause");
    const [a,b]=await Promise.all([changeListing(db,owner,"pause-same",f.id,pause),changeListing(db,owner,"pause-same",f.id,pause)]);
    assert.deepEqual(a,b);assert.equal(a.status,"paused");
    assert.equal((await listingControls(db,owner,f.id)).canResume,true);
    await assert.rejects(publicStay(db,f.id),/not_found/);
    assert.ok(!(await browseStays(db)).items.some(x=>x.id===f.id));
    assert.equal((await readBooking(db,guest,pending.id)).status,"pending");
    assert.equal((await readBooking(db,owner,booked.id)).status,"confirmed");
    assert.deepEqual(await listingSnapshot(db),initial);
    const resume=await listingBody(db,f.id,"resume");
    await changeListing(db,owner,"resume-same",f.id,resume);
    assert.equal((await publicStay(db,f.id)).id,f.id);
    assert.deepEqual(await listingSnapshot(db),initial);
    assert.deepEqual(await changeListing(db,owner,"pause-same",f.id,pause),a);
    assert.equal((await listingControls(db,owner,f.id)).publication,"published");
    assert.equal(await scalar(db,"SELECT count(*) n FROM listing_control_event"),2);
    await assert.rejects(changeListing(db,owner,"pause-same",f.id,resume),/idempotency_conflict/);
    await changeListing(db,owner,"pause-again",f.id,await listingBody(db,f.id,"pause"));
    await transition(db,owner,"visibility-decline",pending.id,"decline");
    await transition(db,owner,"visibility-cancel",booked.id,"cancel_owner","Fixture correction");
    assert.equal(await scalar(db,"SELECT sum(reserved) n FROM inventory_night WHERE room_type_id=?",f.roomId),0);
  }finally{await p.dispose();}
});
test("visibility inputs and current verified ownership are strict; historical/unknown pauses cannot self-resume",async()=>{
  const p=await database();try{
    const db=p.db,f=await listingFixture(db),body=await listingBody(db,f.id,"pause");
    for(const actor of [other,guest])await assert.rejects(changeListing(db,actor,"wrong",f.id,body),/not_found/);
    await assert.rejects(changeListing(db,unverified,"wrong",f.id,body),/verified_session_required/);
    for(const changed of [{action:["pause"]},{action:{}},{action:"delete"},{action:"toggle"},{revision:-1},{revision:0.1},{revision:null},{reviewId:[]},{confirmed:false},{extra:true}])
      await assert.rejects(changeListing(db,owner,"bad",f.id,{...body,...changed}),/invalid_listing_control/);
    await db.prepare("UPDATE place SET publication='paused' WHERE id=?").bind(f.id).run();
    assert.equal((await listingControls(db,owner,f.id)).canResume,false);
    await assert.rejects(changeListing(db,owner,"legacy-resume",f.id,{...body,action:"resume"}),/booking_conflict/);
    assert.equal(await scalar(db,"SELECT count(*) n FROM listing_control_event"),0);
    await db.prepare("UPDATE property SET owner_id='other' WHERE id=?").bind(f.id).run();
    await assert.rejects(listingControls(db,owner,f.id),/not_found/);
  }finally{await p.dispose();}
});
test("competing keys/stale tabs and lost commit responses do not duplicate or reverse visibility",async()=>{
  const p=await database();try{
    const db=p.db,f=await listingFixture(db),body=await listingBody(db,f.id,"pause");
    const results=await Promise.allSettled([changeListing(db,owner,"race-a",f.id,body),changeListing(db,owner,"race-b",f.id,body)]);
    assert.equal(results.filter(r=>r.status==="fulfilled").length,1);
    const resume=await listingBody(db,f.id,"resume");
    const lost=beforeListingBatch(db,async()=>{throw new Error("fixture lost response");},true);
    assert.equal((await changeListing(lost,owner,"resume-lost",f.id,resume)).status,"published");
    assert.equal((await changeListing(db,owner,"resume-lost",f.id,resume)).status,"published");
    await assert.rejects(changeListing(db,owner,"stale",f.id,body),/booking_conflict/);
    assert.equal(await scalar(db,"SELECT count(*) n FROM listing_control_event"),2);
  }finally{await p.dispose();}
});
test("commit-time owner/verification/state races and required audit/receipt failures roll back the whole action",async()=>{
  for(const failure of ["owner","verification","state","event","receipt"]){
    const p=await database();try{
      const db=p.db,f=await listingFixture(db),body=await listingBody(db,f.id,"pause");
      if(failure==="event")await db.prepare("CREATE TRIGGER fixture_fail_visibility BEFORE INSERT ON listing_control_event BEGIN SELECT RAISE(ABORT,'invalid_fixture_event'); END").run();
      if(failure==="receipt")await db.prepare("CREATE TRIGGER fixture_fail_visibility BEFORE UPDATE OF result_json ON operation WHEN NEW.kind='listing_pause' BEGIN SELECT RAISE(ABORT,'invalid_fixture_receipt'); END").run();
      const race=beforeListingBatch(db,async()=>{
        if(failure==="owner")await db.prepare("UPDATE property SET owner_id='other' WHERE id=?").bind(f.id).run();
        if(failure==="verification")await db.prepare("UPDATE user SET emailVerified=0 WHERE id='owner'").run();
        if(failure==="state")await db.prepare("UPDATE place SET publication='paused' WHERE id=?").bind(f.id).run();
      });
      await assert.rejects(changeListing(race,owner,"refused",f.id,body),/booking_conflict/);
      assert.equal(await scalar(db,"SELECT count(*) n FROM listing_control_event"),0);
      assert.equal(await scalar(db,"SELECT count(*) n FROM operation WHERE key='refused'"),0);
      assert.equal((await db.prepare("SELECT publication FROM place WHERE id=?").bind(f.id).first<{publication:string}>())!.publication,failure==="state"?"paused":"published");
    }finally{await p.dispose();}
  }
});
test("resume preserves existing calendar/reviewer policy but rejects changed terms/ready-photo evidence; public storage reads fence a pause",async()=>{
  const p=await database();try{
    const db=p.db,f=await listingFixture(db),pause=await listingBody(db,f.id,"pause");
    await assert.rejects(readPublicPhoto(db,{get:async()=>{await changeListing(db,owner,"pause-during-photo",f.id,pause);return {body:new ReadableStream()} as R2ObjectBody;}},f.id,f.photoId!),/not_found/);
    await db.prepare("UPDATE pilot_publication_config SET reviewer_user_id='owner',revision=revision+1 WHERE singleton=1").run();
    await db.prepare("UPDATE inventory_night SET blocked=capacity WHERE room_type_id=?").bind(f.roomId).run();
    assert.equal((await listingControls(db,owner,f.id)).canResume,true);
    await changeListing(db,owner,"resume-after-stock",f.id,await listingBody(db,f.id,"resume"));
    await changeListing(db,owner,"pause-for-terms",f.id,await listingBody(db,f.id,"pause"));
    await db.prepare("UPDATE property SET terms_version='different' WHERE id=?").bind(f.id).run();
    assert.equal((await listingControls(db,owner,f.id)).canResume,false);
    await assert.rejects(changeListing(db,owner,"bad-terms",f.id,await listingBody(db,f.id,"resume")),/listing_resume_unavailable/);
    await db.prepare("UPDATE property SET terms_version='approved-v1' WHERE id=?").bind(f.id).run();
    const resume=await listingBody(db,f.id,"resume");
    const racing=beforeListingBatch(db,async()=>{await db.prepare("UPDATE property_media SET state='removed',cleanup_at=unixepoch() WHERE id=?").bind(f.photoId).run();});
    await assert.rejects(changeListing(racing,owner,"photo-race",f.id,resume),/booking_conflict/);
  }finally{await p.dispose();}
});
test("pause fences a prepared online submission and populated 0018 upgrades retain all prior data/receipts without invented control history",async()=>{
  const p=await database({migrate:false});try{
    const db=p.db;await migrate(db,env.TEST_MIGRATIONS.filter(m=>m.name<"0019").map(m=>m.name));
    const f=await listingFixture(db),existing=await request(db,f.input,"visibility-old-booking"),before=await listingSnapshot(db);
    await migrate(db);await migrate(db);
    assert.deepEqual(await listingSnapshot(db),before);
    assert.deepEqual(await request(db,f.input,"visibility-old-booking"),existing);
    assert.equal(await scalar(db,"SELECT count(*) n FROM listing_control_event"),0);
    const q=await quote(db,guest,f.input),body=await listingBody(db,f.id,"pause");
    const racing=beforeListingBatch(db,()=>changeListing(db,owner,"pause-before-submit",f.id,body));
    await assert.rejects(submit(racing,guest,"blocked-new-request",f.input,q.hash),/booking_conflict/);
    assert.equal(await scalar(db,"SELECT count(*) n FROM booking WHERE property_id=?",f.id),1);
    assert.equal(await scalar(db,"SELECT sum(reserved) n FROM inventory_night WHERE room_type_id=?",f.roomId),0);
    await assert.rejects(db.prepare("UPDATE listing_control_event SET action='resume'").run(),/immutable_listing_control/);
    await assert.rejects(db.prepare("DELETE FROM listing_control_event").run(),/retained_listing_control/);
    assert.deepEqual((await db.prepare("PRAGMA foreign_key_check").all()).results,[]);
  }finally{await p.dispose();}
});
