import { runtime } from "../../../../src/runtime";
import { stagingAuthRead } from "../../../../src/runtime-policy";
import { stagingAuthAction, STAGING_ACCOUNTS } from "../../../../src/staging-accounts";
export const dynamic = "force-dynamic";
async function handler(request: Request) {
  const { auth, readOnly, fixtureTest } = await runtime();
  if (readOnly)
    return Response.json(
      stagingAuthRead(request) ? null : { error: "staging_read_only" },
      { status: stagingAuthRead(request) ? 200 : 503, headers: {
        "Cache-Control": "private, no-store",
        "X-Robots-Tag": "noindex, nofollow",
      } },
    );
  const action = fixtureTest ? await stagingAuthAction(request) : null;
  if (fixtureTest && !action)
    return Response.json({ error: "staging_email_unavailable" }, {
      status: 503, headers: { "Cache-Control": "private, no-store", "X-Robots-Tag": "noindex, nofollow" },
    });
  const response = await auth.handler(request);
  if (fixtureTest && action === "session" && response.ok) {
    const data = await response.clone().json() as { user?: { id?: string } } | null;
    if (data?.user?.id && !STAGING_ACCOUNTS.some(account => account.id === data.user!.id))
      return Response.json(null, { headers: { "Cache-Control": "private, no-store" } });
  }
  response.headers.set("Cache-Control", "private, no-store");
  if (fixtureTest) response.headers.set("X-Robots-Tag", "noindex, nofollow");
  return response;
}
export { handler as GET, handler as POST };
