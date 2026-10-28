import { runtime } from "../../../../src/runtime";
export const dynamic = "force-dynamic";
async function handler(request: Request) {
  const response = await (await runtime()).auth.handler(request);
  response.headers.set("Cache-Control", "private, no-store");
  return response;
}
export { handler as GET, handler as POST };
