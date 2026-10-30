import { readFile } from "node:fs/promises";
import path from "node:path";
import { hashPassword, verifyPassword } from "better-auth/crypto";
import { STAGING_ACCOUNTS } from "../apps/web/src/staging-accounts";
import { createPropertyDraft } from "@root-of-cambodia/backend/property-drafts";
import { savePropertyInformation } from "@root-of-cambodia/backend/property-information";
import { savePropertyLogistics } from "@root-of-cambodia/backend/property-logistics";
import { createRoomType } from "@root-of-cambodia/backend/room-types";
import { saveRoomCalendar } from "@root-of-cambodia/backend/calendar";
import { preparePhoto, photoDigest, uploadPhoto } from "@root-of-cambodia/backend/media";
import { photoProcessor } from "../apps/web/src/media-runtime";
import { ownerProperty } from "@root-of-cambodia/backend/property-queries";
import { ownerReviewAction, decideReview } from "@root-of-cambodia/backend/publication";
import { readSnapshot, requestRecord, reviewConfig } from "@root-of-cambodia/backend/publication-queries";
import { publicDisclosurePreview } from "@root-of-cambodia/backend/public-listing";
import { guestQuote, saveGuestAttempt, sendGuestAttempt } from "@root-of-cambodia/backend/guest-bookings";
import { acceptancePreview } from "@root-of-cambodia/backend/booking-logistics";
import { transition } from "@root-of-cambodia/backend/bookings";

export type StagingCredential = { id: string; password: string };
export const STAGING_TERMS_VERSION = "staging-demo-terms-v1";
export const STAGING_TERMS = "FICTIONAL STAGING TEST ONLY. No real accommodation, reservation, payment or legal agreement is offered. Prices and people are sample data. Do not enter real guest information. Email delivery is disabled.";
const owner = { id: STAGING_ACCOUNTS[0].id }, guest = { id: STAGING_ACCOUNTS[1].id }, reviewer = { id: STAGING_ACCOUNTS[2].id };

export async function seedStagingAccounts(db: D1Database, credentials: StagingCredential[]) {
  if (credentials.length !== STAGING_ACCOUNTS.length || new Set(credentials.map(c => c.id)).size !== credentials.length)
    throw new Error("Supply exactly the fictional staging identities");
  const users = (await db.prepare("SELECT id,email FROM user").all<{id:string;email:string}>()).results;
  if (users.some(user => !STAGING_ACCOUNTS.some(account => account.id === user.id && account.email === user.email)))
    throw new Error("Non-fixture accounts exist; refusing staging bootstrap");
  for (const identity of STAGING_ACCOUNTS) {
    const credential = credentials.find(value => value.id === identity.id);
    if (!credential || credential.password.length < 24 || credential.password.length > 128)
      throw new Error("Provide private, strong staging credentials");
    const old = await db.prepare("SELECT password FROM account WHERE userId=? AND providerId='credential'").bind(identity.id).first<{password:string}>();
    if (old) {
      if (!await verifyPassword({hash:old.password,password:credential.password}))
        throw new Error("Existing test credentials differ; refusing to overwrite");
      continue;
    }
    if (users.some(user => user.id === identity.id)) throw new Error("Incomplete existing fixture identity; inspect before retry");
    const passwordHash = await hashPassword(credential.password), now = Date.now();
    await db.batch([
      // Explicit fictional fixtures, never marking an actual customer verified.
      db.prepare('INSERT INTO user(id,name,email,emailVerified,createdAt,updatedAt) VALUES(?,?,?,1,?,?)').bind(identity.id,identity.name,identity.email,now,now),
      db.prepare('INSERT INTO account(id,accountId,providerId,userId,password,createdAt,updatedAt) VALUES(?,?,\'credential\',?,?,?,?)').bind(identity.id+":credential",identity.id,identity.id,passwordHash,now,now),
    ]);
  }
}

const day = (night: string, offset: number) => new Date(Date.parse(night+"T00:00:00Z")+offset*86400000).toISOString().slice(0,10);
export async function seedStagingProperties(env: {DB:D1Database;MEDIA:R2Bucket;IMAGES:ImagesBinding}, root: string) {
  const db = env.DB;
  const existing = await reviewConfig(db);
  if (existing && (existing.reviewerId !== reviewer.id || existing.termsVersion !== STAGING_TERMS_VERSION))
    throw new Error("Existing reviewer/terms configuration is not the staging fixture");
  await db.prepare("INSERT INTO booking_terms_document(version,content) VALUES(?,?) ON CONFLICT(version) DO NOTHING").bind(STAGING_TERMS_VERSION,STAGING_TERMS).run();
  const terms = await db.prepare("SELECT content FROM booking_terms_document WHERE version=?").bind(STAGING_TERMS_VERSION).first<{content:string}>();
  if (terms?.content !== STAGING_TERMS) throw new Error("Existing immutable demo terms differ");
  await db.prepare("INSERT INTO pilot_publication_config(singleton,reviewer_user_id,terms_version) VALUES(1,?,?) ON CONFLICT(singleton) DO NOTHING").bind(reviewer.id,STAGING_TERMS_VERSION).run();
  const results: {id:string;roomId:string;name:string;state:string;start:string;end:string}[] = [];
  const fixtures = [
    {slug:"kampot",name:"Demo Riverside Homestay",km:"ផ្ទះស្នាក់នៅសាកល្បងកំពត",province:"Kampot",cents:2800,publish:true},
    {slug:"siem-reap",name:"Demo Garden Guesthouse",km:"ផ្ទះសំណាក់សាកល្បងសៀមរាប",province:"Siem Reap",cents:4200,publish:true},
    {slug:"mondulkiri",name:"Demo Forest Bungalow",km:"បឹងហ្គាឡូសាកល្បងមណ្ឌលគិរី",province:"Mondulkiri",cents:3500,publish:false},
  ];
  for (const fixture of fixtures) {
    const prefix = "staging-demo-v1:"+fixture.slug+":";
    const property = await createPropertyDraft(db,owner,prefix+"create",{
      ownerName:"Demo property owner",nameKm:fixture.km,nameEn:fixture.name,province:fixture.province,
      checkinTime:"14:00",checkoutTime:"11:00",policyText:"Fictional staging property. No real guests, accommodation or payments.",
    });
    const first = await db.prepare("SELECT date(occurred_at,'unixepoch','+3 days') start FROM property_draft_event WHERE property_id=? AND kind='created'").bind(property.id).first<{start:string}>();
    if (!first) throw new Error("Missing fixture creation history");
    const start=first.start;
    const reviewed = await db.prepare("SELECT id FROM property_review_request WHERE property_id=? LIMIT 1").bind(property.id).first();
    // A reviewed fixture may have been changed during testing. Never republish,
    // rewrite edits, restore removed media or reapply initial calendar values.
    if (reviewed) {
      const room = await db.prepare("SELECT id FROM room_type WHERE property_id=? ORDER BY id LIMIT 1").bind(property.id).first<{id:string}>();
      if (!room) throw new Error("Existing fixture has no room");
      results.push({id:property.id,roomId:room.id,name:fixture.name,state:(await ownerProperty(db,owner,property.id)).publication,start,end:day(start,35)});
      continue;
    }
    await savePropertyInformation(db,owner,prefix+"info",property.id,{description:`${fixture.name} is a fictional property for testing ROOTS OF CAMBODIA. Try its room calendar, booking request and publication workflow.`,address:`Demo Lane, ${fixture.province} (not a real address)`,facilities:["Demo garden","Test Wi-Fi","Sample breakfast"],revision:null});
    await savePropertyLogistics(db,owner,prefix+"logistics",property.id,{latitude:null,longitude:null,contactName:"Demo host",contactPhone:"",contactEmail:"host@roc-staging.invalid",arrivalInstructions:"TEST ONLY: these are sample arrival instructions, not directions to a real property.",revision:null});
    const room = await createRoomType(db,owner,prefix+"room",property.id,{name:"Demo garden room",adultCapacity:2,childCapacity:1,totalCapacity:3});
    for (let offset=0;offset<35;offset+=7) await saveRoomCalendar(db,owner,prefix+"calendar:"+offset,property.id,room.id,{roomRevision:1,nights:Array.from({length:7},(_,i)=>({night:day(start,offset+i),capacity:4,blocked:0,unitCents:fixture.cents,inventoryRevision:null,rateRevision:null}))});
    const bytes = new Uint8Array(await readFile(path.join(root,"fixtures/staging",fixture.slug+".jpg")));
    const photo = await preparePhoto(db,owner,prefix+"photo",property.id,{contentType:"image/jpeg",byteSize:bytes.length,sha256:await photoDigest(bytes),revision:null});
    await uploadPhoto(db,env.MEDIA,photoProcessor(env.IMAGES),owner,property.id,photo.id,bytes);
    const current=await ownerProperty(db,owner,property.id),snapshot=await readSnapshot(db,property.id,owner.id);
    const preview=await publicDisclosurePreview(snapshot.data);
    const submission=await ownerReviewAction(db,owner,prefix+"submit",property.id,{action:"submit",propertyRevision:current.revision,publicDisclosure:{version:preview.version,previewHash:preview.previewHash}});
    if (fixture.publish) {
      const request=await requestRecord(db,submission.id),config=await reviewConfig(db);
      if (!config) throw new Error("Missing fixture reviewer");
      await decideReview(db,reviewer,prefix+"approve",submission.id,{action:"approve",revision:request.revision,configRevision:config.revision});
    }
    results.push({id:property.id,roomId:room.id,name:fixture.name,state:fixture.publish?"published":"review",start,end:day(start,35)});
  }
  const draft=await createPropertyDraft(db,owner,"staging-demo-v1:empty-draft",{ownerName:"Demo property owner",nameKm:"សេចក្ដីព្រាងសាកល្បង",nameEn:"Demo New Property Draft",province:"Kep",checkinTime:"14:00",checkoutTime:"11:00",policyText:"Fictional draft for testing. Add rooms, information and a photo, then submit it to the demo reviewer."});
  const bookings: {id:string;status:string}[]=[];
  for (let i=0;i<2;i++) {
    const property=results[i],attemptId=`00000000-0000-4000-8000-00000000010${i}`;
    if (await db.prepare("SELECT 1 ok FROM guest_booking_attempt WHERE id=?").bind(attemptId).first()) continue;
    const input={propertyId:property.id,checkin:day(property.start,3+i*2),checkout:day(property.start,5+i*2),termsVersion:STAGING_TERMS_VERSION,lines:[{roomId:property.roomId,quantity:1,adults:2,children:0}]};
    const q=await guestQuote(db,guest,input);
    await saveGuestAttempt(db,guest,attemptId,input,q.hash);
    const receipt=await sendGuestAttempt(db,guest,attemptId,true);
    if(i===1) {
      const preview=await acceptancePreview(db,owner,receipt.id);
      await transition(db,owner,"staging-demo-v1:accept:"+receipt.id,receipt.id,"accept",undefined,preview.hash);
    }
    bookings.push({id:receipt.id,status:i===1?"confirmed":"pending"});
  }
  return {properties:results,draftId:draft.id,bookings};
}
