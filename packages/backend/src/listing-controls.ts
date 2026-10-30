import { verified, type Actor } from "./operations";
import { requireOwnedProperty } from "./access";
import { DomainError } from "./errors";
import { commitListingControl, type ListingInput } from "./listing-control-persistence";
export async function changeListing(db:D1Database,actor:Actor,key:string,propertyId:string,raw:unknown) {
  await verified(db,actor); await requireOwnedProperty(db,actor,propertyId);
  if(!raw || typeof raw!=="object" || Array.isArray(raw))throw new DomainError("invalid_listing_control",422);
  const b=raw as Record<string,unknown>;
  if(Object.keys(b).some(k=>!["action","revision","reviewId","confirmed"].includes(k)) ||
    typeof b.action!=="string" || !["pause","resume","reopen"].includes(b.action) || !Number.isSafeInteger(b.revision) ||
    Number(b.revision)<0 || Number(b.revision)>=2147483647 ||
    !(b.reviewId===null || typeof b.reviewId==="string" && /^[A-Za-z0-9_-]{1,128}$/.test(b.reviewId)) ||
    b.confirmed!==true) throw new DomainError("invalid_listing_control",422);
  const result=await commitListingControl(db,actor,key,propertyId,b as ListingInput);
  await verified(db,actor); await requireOwnedProperty(db,actor,propertyId);
  return result;
}
