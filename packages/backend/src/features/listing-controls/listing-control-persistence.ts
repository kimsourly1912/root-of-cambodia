import { operate, type Actor } from "../../shared/index";
import { DomainError } from "../../shared/index";
import { resumeApproval } from "./listing-control-queries";
export type ListingAction="pause"|"resume"|"reopen";
export type ListingInput={action:ListingAction;revision:number;reviewId:string|null;confirmed:true};
export async function commitListingControl(db:D1Database,actor:Actor,key:string,propertyId:string,input:ListingInput) {
  return operate(db,actor,key,{kind:"listing_"+input.action,propertyId,revision:input.revision,reviewId:input.reviewId},async op=>{
    if(input.action==="resume" && !await resumeApproval(db,actor,propertyId,input.reviewId))
      throw new DomainError("listing_resume_unavailable");
    return [
      db.prepare(`INSERT INTO listing_control_event(operation_id,property_id,actor_id,review_id,revision,action,from_state,to_state)
        VALUES(?,?,?,?,?,?,?,?)`).bind(op,propertyId,actor.id,input.reviewId,input.revision+1,input.action,
        input.action==="pause"?"published":"paused",input.action==="pause"?"paused":input.action==="reopen"?"draft":"published"),
      db.prepare(`UPDATE operation SET result_json=(SELECT json_object('id',property_id,'status',to_state)
        FROM listing_control_event WHERE operation_id=?) WHERE id=?`).bind(op,op)
    ];
  },"owner");
}
