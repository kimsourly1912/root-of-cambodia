import { runtime } from "../../../../src/runtime";
import { stagingAuthRead } from "../../../../src/runtime-policy";
export const dynamic = "force-dynamic";
async function handler(request: Request) {
  const { auth, readOnly } = await runtime();
  if (readOnly)
    return Response.json(
      stagingAuthRead(request) ? null : { error: "staging_read_only" },
      { status: stagingAuthRead(request) ? 200 : 503, headers: {
        "Cache-Control": "private, no-store",
        "X-Robots-Tag": "noindex, nofollow",
      } },
    );
  const response = await auth.handler(request);
  response.headers.set("Cache-Control", "private, no-store");
  return response;
}
export { handler as GET, handler as POST };
