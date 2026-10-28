import {runtime} from "../../../src/runtime";
export const dynamic="force-dynamic";
export async function GET(request:Request) {
  const {auth}=await runtime();
  const session=await auth.api.getSession({headers:request.headers});
  return Response.json({authenticated:!!session,verified:session?.user.emailVerified??false},{headers:{"Cache-Control":"private, no-store"}});
}
