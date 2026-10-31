import { catalog,owner,other } from "./support";
import { createPropertyDraft } from "@root-of-cambodia/backend/properties";
import { readyPublicationFixture } from "./publication-fixtures";
import { ownerPublication } from "@root-of-cambodia/backend/publication";
import { ownerReviewAction,decideReview } from "@root-of-cambodia/backend/publication";
import { listingControls } from "@root-of-cambodia/backend/listing-controls";
export async function listingFixture(db:D1Database) {
  await catalog(db);
  await db.prepare("INSERT INTO pilot_publication_config VALUES(1,'other','approved-v1',1)").run();
  const {id}=await createPropertyDraft(db,owner,"listing-fixture",{ownerName:"Owner",nameKm:"ផ្ទះសំណាក់",nameEn:"Listing stay",
    province:"Kampot",checkinTime:"14:00",checkoutTime:"11:00",policyText:"Quiet nights."});
  const supply=await readyPublicationFixture(db,owner,id);
  const view=await ownerPublication(db,owner,id);
  const review=await ownerReviewAction(db,owner,"listing-submit",id,{action:"submit",propertyRevision:view.propertyRevision,
    publicDisclosure:{version:view.publicPreview!.version,previewHash:view.publicPreview!.previewHash}});
  await decideReview(db,other,"listing-approve",review.id,{action:"approve",revision:1,configRevision:1});
  const checkout=new Date(Date.parse(supply.night)+86400000).toISOString().slice(0,10);
  return {id,...supply,reviewId:review.id,input:{propertyId:id,checkin:supply.night,checkout,termsVersion:"approved-v1",
    lines:[{roomId:supply.roomId,quantity:1,adults:2,children:0}]}};
}
export async function listingBody(db:D1Database,id:string,action:string) {
  const s=await listingControls(db,owner,id);
  return {action,revision:s.revision,reviewId:s.reviewId,confirmed:true};
}
export function beforeListingBatch(db:D1Database,run:()=>Promise<unknown>,after=false) {
  let first=true;
  return new Proxy(db,{get(target,key){
    if(key==="batch")return async(statements:D1PreparedStatement[])=>{
      if(first&&!after){first=false;await run();}
      const result=await target.batch(statements);
      if(first&&after){first=false;await run();}
      return result;
    };
    const value=Reflect.get(target,key);return typeof value==="function"?value.bind(target):value;
  }});
}
export async function listingSnapshot(db:D1Database) {
  const tables=["booking","booking_line","booking_night","booking_event","allocation","inventory_night","nightly_rate","notification_outbox",
    "booking_acceptance","booking_payment_event","booking_payment_state","property_review_request","public_listing_disclosure"];
  return Promise.all(tables.map(async table=>(await db.prepare("SELECT * FROM "+table+" ORDER BY rowid").all()).results));
}
