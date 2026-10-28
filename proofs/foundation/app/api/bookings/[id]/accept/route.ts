import {runtime} from "../../../../../src/runtime";
import {accept,BookingError} from "../../../../../src/booking";
export const dynamic="force-dynamic";
export async function POST(request:Request,context:{params:Promise<{id:string}>}) {
  const {env,auth}=await runtime();
  // Deliberate same-origin JSON endpoint; browser UI uses this route, not a debug API.
  if(request.headers.get("origin")!==env.AUTH_URL) return Response.json({error:"forbidden"},{status:403});
  const session=await auth.api.getSession({headers:request.headers});
  if(!session) return Response.json({error:"unauthorized"},{status:401});
  try {
    const result=await accept(env.DB,(await context.params).id,{id:session.user.id,emailVerified:session.user.emailVerified});
    return Response.json(result,{headers:{"Cache-Control":"private, no-store"}});
  }catch(error){
    const code=error instanceof BookingError?error.code:"inventory_conflict";
    return Response.json({error:code},{status:code==="not_found"?404:409,headers:{"Cache-Control":"private, no-store"}});
  }
}
