import { test } from "vitest";
import assert from "node:assert/strict";
import { env } from "cloudflare:workers";
import { database,migrate,owner,other,guest,unverified,request,scalar } from "../../../testing/support";
import { listingFixture,listingBody,beforeListingBatch,listingSnapshot } from "../../../testing/listing-fixtures";
import { changeListing } from "@root-of-cambodia/backend/listing-controls";
import { listingControls } from "@root-of-cambodia/backend/listing-controls";
import { ownerProperty } from "@root-of-cambodia/backend/properties";
import { updatePropertyDraft } from "@root-of-cambodia/backend/properties";
import { savePropertyInformation } from "@root-of-cambodia/backend/property-information";
import { savePropertyLogistics } from "@root-of-cambodia/backend/property-logistics";
import { updateRoomType } from "@root-of-cambodia/backend/rooms";
import { saveRoomCalendar } from "@root-of-cambodia/backend/calendar";
import { ownerRoomCalendar } from "@root-of-cambodia/backend/calendar";
import { ownerPublication } from "@root-of-cambodia/backend/publication";
import { ownerReviewAction,decideReview } from "@root-of-cambodia/backend/publication";
import { publicStay,readPublicPhoto } from "@root-of-cambodia/backend/catalog";
import { acceptancePreview } from "@root-of-cambodia/backend/bookings";
import { transition,submit } from "@root-of-cambodia/backend/bookings";
import { quote } from "@root-of-cambodia/backend/quotes";
import { guestBooking } from "@root-of-cambodia/backend/bookings";
const accept=async(db:D1Database,id:string)=>transition(db,owner,crypto.randomUUID(),id,"accept",undefined,(await acceptancePreview(db,owner,id)).hash);
const pause=async(db:D1Database,id:string)=>changeListing(db,owner,crypto.randomUUID(),id,await listingBody(db,id,"pause"));
test("offline corrections preserve existing booking identities/quotes/logistics, require new acknowledgement/review and fence old visibility receipts",async()=>{
  const p=await database();try{
    const db=p.db,f=await listingFixture(db);
    await pause(db,f.id);
    const oldResume=await listingBody(db,f.id,"resume");
    const resumeReceipt=await changeListing(db,owner,"old-successful-resume",f.id,oldResume);
    const first=await request(db,f.input),second=await request(db,f.input);
    await accept(db,first.id);
    const original=await guestBooking(db,guest,first.id),pending=await guestBooking(db,guest,second.id);
    const oldPreview=(await ownerPublication(db,owner,f.id)).publicPreview!;
    await pause(db,f.id);
    const uncommittedResume=await listingBody(db,f.id,"resume"),reopen=await listingBody(db,f.id,"reopen");
    const before=await listingSnapshot(db);
    const receipt=await changeListing(db,owner,"start-corrections",f.id,reopen);
    assert.equal(receipt.status,"draft");
    assert.deepEqual(await listingSnapshot(db),before);
    assert.equal((await listingControls(db,owner,f.id)).canResume,false);
    assert.equal((await listingControls(db,owner,f.id)).correctionDraft,true);
    assert.deepEqual(await changeListing(db,owner,"old-successful-resume",f.id,oldResume),resumeReceipt);
    assert.equal((await listingControls(db,owner,f.id)).publication,"draft");
    await assert.rejects(changeListing(db,owner,"stale-uncommitted-resume",f.id,uncommittedResume),/listing_resume_unavailable/);
    await assert.rejects(publicStay(db,f.id),/not_found/);
    const property=await ownerProperty(db,owner,f.id);
    const {id:_id,publication:_pub,...fields}=property;
    await updatePropertyDraft(db,owner,"correct-basics",f.id,{...fields,nameEn:"Corrected stay",checkinTime:"15:00"});
    await savePropertyInformation(db,owner,"correct-information",f.id,{description:"Corrected public description",address:"New private arrival address",facilities:["Parking"],revision:1});
    await savePropertyLogistics(db,owner,"correct-logistics",f.id,{latitude:null,longitude:null,contactName:"",
      contactPhone:"",contactEmail:"corrected@example.invalid",arrivalInstructions:"New private directions",revision:1});
    await updateRoomType(db,owner,"correct-room",f.id,f.roomId,{name:"Renamed garden room",adultCapacity:2,childCapacity:0,totalCapacity:2,revision:1});
    const calendar=await ownerRoomCalendar(db,owner,f.id,f.roomId,f.night),n=calendar.nights[0];
    const night={night:f.night,capacity:0,blocked:0,unitCents:4000,inventoryRevision:n.inventoryRevision,rateRevision:n.rateRevision};
    await assert.rejects(saveRoomCalendar(db,owner,"unsafe-stock-correction",f.id,f.roomId,{roomRevision:calendar.roomRevision,nights:[night]}),/booking_conflict/);
    await saveRoomCalendar(db,owner,"correct-calendar",f.id,f.roomId,{roomRevision:calendar.roomRevision,nights:[{...night,capacity:2}]});
    assert.deepEqual(await guestBooking(db,guest,first.id),original);
    assert.deepEqual(await guestBooking(db,guest,second.id),pending);
    await accept(db,second.id);
    const laterAccepted=await guestBooking(db,guest,second.id);
    assert.equal(laterAccepted.totalCents,pending.totalCents);
    assert.equal(laterAccepted.logistics!.contactEmail,"corrected@example.invalid");
    assert.equal((await guestBooking(db,guest,first.id)).logistics!.contactEmail,"stay@example.invalid");
    const current=await ownerPublication(db,owner,f.id);
    await assert.rejects(ownerReviewAction(db,owner,"reuse-old-public-preview",f.id,{action:"submit",propertyRevision:current.propertyRevision,
      publicDisclosure:{version:oldPreview.version,previewHash:oldPreview.previewHash}}),/public_disclosure_changed/);
    const submitted=await ownerReviewAction(db,owner,"corrected-submission",f.id,{action:"submit",propertyRevision:current.propertyRevision,
      publicDisclosure:{version:current.publicPreview!.version,previewHash:current.publicPreview!.previewHash}});
    assert.notEqual(submitted.id,f.reviewId);
    await assert.rejects(publicStay(db,f.id),/not_found/);
    await assert.rejects(changeListing(db,owner,"resume-during-review",f.id,uncommittedResume),/listing_resume_unavailable/);
    await decideReview(db,other,"approve-corrections",submitted.id,{action:"approve",revision:1,configRevision:1});
    const listing=await publicStay(db,f.id);
    assert.equal(listing.nameEn,"Corrected stay");assert.equal(listing.description,"Corrected public description");
    assert.equal(listing.rooms[0].id,f.roomId);assert.equal(listing.rooms[0].name,"Renamed garden room");
    assert.deepEqual(await guestBooking(db,guest,first.id),original);
    assert.deepEqual(await guestBooking(db,guest,second.id),laterAccepted);
    assert.deepEqual(await changeListing(db,owner,"start-corrections",f.id,reopen),receipt);
    assert.equal((await listingControls(db,owner,f.id)).publication,"published");
    const snapshots=(await db.prepare("SELECT snapshot_json FROM property_review_request WHERE property_id=? ORDER BY sequence").bind(f.id).all<{snapshot_json:string}>()).results;
    assert.equal(snapshots.length,2);
    assert.equal(JSON.parse(snapshots[0].snapshot_json).property.nameEn,"Listing stay");
    assert.equal(await scalar(db,"SELECT count(*) n FROM booking WHERE property_id=?",f.id),2);
  }finally{await p.dispose();}
});
test("correction intent is explicit and scoped; competing reopen/resume keys and stale tabs commit only once",async()=>{
  const p=await database();try{
    const db=p.db,f=await listingFixture(db);
    await assert.rejects(changeListing(db,owner,"published-reopen",f.id,await listingBody(db,f.id,"reopen")),/booking_conflict/);
    await pause(db,f.id);
    const reopen=await listingBody(db,f.id,"reopen"),resume=await listingBody(db,f.id,"resume");
    for(const actor of [guest,other])await assert.rejects(changeListing(db,actor,"wrong",f.id,reopen),/not_found/);
    await assert.rejects(changeListing(db,unverified,"wrong",f.id,reopen),/verified_session_required/);
    await assert.rejects(changeListing(db,owner,"no-confirm",f.id,{...reopen,confirmed:false}),/invalid_listing_control/);
    const race=await Promise.allSettled([changeListing(db,owner,"reopen-race",f.id,reopen),changeListing(db,owner,"resume-race",f.id,resume)]);
    assert.equal(race.filter(r=>r.status==="fulfilled").length,1);
    if((await listingControls(db,owner,f.id)).publication==="published")await pause(db,f.id);
    if((await listingControls(db,owner,f.id)).publication==="paused"){
      const body=await listingBody(db,f.id,"reopen");
      assert.equal((await changeListing(db,owner,"finish-reopen",f.id,body)).status,"draft");
    }
    assert.equal((await listingControls(db,owner,f.id)).publication,"draft");
    await assert.rejects(changeListing(db,owner,"stale-reopen",f.id,reopen),/booking_conflict/);
    await assert.rejects(changeListing(db,owner,"reopen-race",f.id,{...reopen,action:"pause"}),/idempotency_conflict|booking_conflict/);
  }finally{await p.dispose();}
});
test("reopen rechecks owner/verification and rolls back its state/event/receipt when a required write fails",async()=>{
  for(const failure of ["owner","verification","event","receipt"]){
    const p=await database();try{
      const db=p.db,f=await listingFixture(db);await pause(db,f.id);
      const body=await listingBody(db,f.id,"reopen"),before=await listingSnapshot(db);
      if(failure==="event")await db.prepare("CREATE TRIGGER fixture_reopen BEFORE INSERT ON listing_control_event WHEN NEW.action='reopen' BEGIN SELECT RAISE(ABORT,'invalid_fixture_event'); END").run();
      if(failure==="receipt")await db.prepare("CREATE TRIGGER fixture_reopen BEFORE UPDATE OF result_json ON operation WHEN NEW.kind='listing_reopen' BEGIN SELECT RAISE(ABORT,'invalid_fixture_receipt'); END").run();
      const race=beforeListingBatch(db,async()=>{
        if(failure==="owner")await db.prepare("UPDATE property SET owner_id='other' WHERE id=?").bind(f.id).run();
        if(failure==="verification")await db.prepare("UPDATE user SET emailVerified=0 WHERE id='owner'").run();
      });
      await assert.rejects(changeListing(race,owner,"reopen-failure",f.id,body),/booking_conflict/);
      assert.equal(await scalar(db,"SELECT count(*) n FROM listing_control_event WHERE action='reopen'"),0);
      assert.equal(await scalar(db,"SELECT count(*) n FROM operation WHERE key='reopen-failure'"),0);
      assert.equal((await db.prepare("SELECT publication FROM place WHERE id=?").bind(f.id).first<{publication:string}>())!.publication,"paused");
      assert.deepEqual(await listingSnapshot(db),before);
    }finally{await p.dispose();}
  }
});
test("withdrawn/returned corrections remain offline and cannot resume the old approval; unknown pauses cannot reopen",async()=>{
  const p=await database();try{
    const db=p.db,f=await listingFixture(db);
    await db.prepare("UPDATE place SET publication='paused' WHERE id=?").bind(f.id).run();
    assert.equal((await listingControls(db,owner,f.id)).canReopen,false);
    await assert.rejects(changeListing(db,owner,"unknown-reopen",f.id,await listingBody(db,f.id,"reopen")),/booking_conflict/);
    await db.prepare("UPDATE place SET publication='published' WHERE id=?").bind(f.id).run();
    await pause(db,f.id);
    await changeListing(db,owner,"reopen-for-return",f.id,await listingBody(db,f.id,"reopen"));
    for(const action of ["withdraw","return_changes"]){
      const view=await ownerPublication(db,owner,f.id);
      const sent=await ownerReviewAction(db,owner,crypto.randomUUID(),f.id,{action:"submit",propertyRevision:view.propertyRevision,
        publicDisclosure:{version:view.publicPreview!.version,previewHash:view.publicPreview!.previewHash}});
      if(action==="withdraw")await ownerReviewAction(db,owner,"withdraw-correction",f.id,{action:"withdraw",requestId:sent.id,revision:1});
      else await decideReview(db,other,"return-correction",sent.id,{action:"return_changes",reason:"Please check the details.",revision:1,configRevision:1});
      assert.equal((await listingControls(db,owner,f.id)).publication,"draft");
      assert.equal((await listingControls(db,owner,f.id)).canResume,false);
      await assert.rejects(publicStay(db,f.id),/not_found/);
    }
    await assert.rejects(readPublicPhoto(db,{get:async()=>null},f.id,f.photoId!),/not_found/);
  }finally{await p.dispose();}
});
test("0020 preserves populated 0019 visibility/bookings/review receipts and extends only the legal correction transition",async()=>{
  const p=await database({migrate:false});try{
    const db=p.db;await migrate(db,env.TEST_MIGRATIONS.filter(m=>m.name<"0020").map(m=>m.name));
    const f=await listingFixture(db),originalQuote=await quote(db,guest,f.input);
    const booking=await submit(db,guest,"retained-correction-booking",f.input,originalQuote.hash);
    const body=await listingBody(db,f.id,"pause"),receipt=await changeListing(db,owner,"retained-owner-pause",f.id,body);
    const business=await listingSnapshot(db),events=(await db.prepare("SELECT * FROM listing_control_event ORDER BY revision").all()).results;
    await migrate(db);await migrate(db);
    assert.deepEqual(await listingSnapshot(db),business);
    assert.deepEqual((await db.prepare("SELECT * FROM listing_control_event ORDER BY revision").all()).results,events);
    assert.deepEqual(await changeListing(db,owner,"retained-owner-pause",f.id,body),receipt);
    // This successful old booking receipt can recover even while the listing is paused.
    assert.deepEqual(await submit(db,guest,"retained-correction-booking",f.input,originalQuote.hash),booking);
    await changeListing(db,owner,"upgraded-reopen",f.id,await listingBody(db,f.id,"reopen"));
    assert.equal((await listingControls(db,owner,f.id)).publication,"draft");
    assert.deepEqual((await db.prepare("PRAGMA foreign_key_check").all()).results,[]);
  }finally{await p.dispose();}
});

test("lost reopen acknowledgement recovers the same committed receipt and never enables old resume",async()=>{
  const p=await database();try{
    const db=p.db,f=await listingFixture(db);await pause(db,f.id);
    const body=await listingBody(db,f.id,"reopen"),before=await listingSnapshot(db);
    const lost=beforeListingBatch(db,async()=>{throw new Error("fixture response lost");},true);
    const receipt=await changeListing(lost,owner,"lost-reopen",f.id,body);
    assert.equal(receipt.status,"draft");
    assert.deepEqual(await changeListing(db,owner,"lost-reopen",f.id,body),receipt);
    assert.equal(await scalar(db,"SELECT count(*) n FROM listing_control_event"),2);
    assert.equal((await listingControls(db,owner,f.id)).canResume,false);
    assert.deepEqual(await listingSnapshot(db),before);
  }finally{await p.dispose();}
});
