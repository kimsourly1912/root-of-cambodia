import { endpoint } from "@/src/http";
import { listingControls } from "@root-of-cambodia/backend/listing-control-queries";
import { changeListing } from "@root-of-cambodia/backend/listing-controls";
export const dynamic="force-dynamic";
type Context={params:Promise<{id:string}>};
export async function GET(request:Request,context:Context) {
  return endpoint(request,false,async({db,actor})=>listingControls(db,actor,(await context.params).id));
}
export async function POST(request:Request,context:Context) {
  return endpoint(request,true,async({db,actor,key,body})=>changeListing(db,actor,key,(await context.params).id,body));
}
