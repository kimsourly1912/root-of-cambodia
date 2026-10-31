import { cache } from "react";
import { headers } from "next/headers";
import { runtime } from "./runtime";

// The signed-in session, read once per server render: the workspace layout,
// the site layout and the page all need it. A read-only site has none. Route
// handlers read their own from the request (server/http.ts).
export const renderSession = cache(async () => {
  const { auth, readOnly } = await runtime();
  return readOnly ? null : auth.api.getSession({ headers: await headers() });
});
