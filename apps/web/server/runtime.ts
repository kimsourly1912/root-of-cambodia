import { cache } from "react";
import { getCloudflareContext } from "@opennextjs/cloudflare";
import { makeAuth } from "@root-of-cambodia/backend/accounts";
import { runtimePolicy } from "./runtime-policy";
// Built once per server render: the layout, metadata, page and session checks
// all call this. Outside a render (route handlers) each call builds its own.
export const runtime = cache(async () => {
  const { env } = await getCloudflareContext({ async: true });
  const policy = runtimePolicy(env.APP_MODE, env.AUTH_URL);
  const auth = makeAuth(env.DB, {
    secret: env.BETTER_AUTH_SECRET,
    baseURL: env.AUTH_URL,
    mailer: {
      send: async (message) => {
        // Defense in depth: staged auth routes refuse activity before the
        // handler, and no live URL/token is ever stored as captured email.
        if (!policy.localCapture) throw new Error("Email delivery is unavailable");
        await env.DB.prepare(
          "INSERT INTO local_email(id,recipient,kind,url) VALUES (?,?,?,?)",
        )
          .bind(
            crypto.randomUUID(),
            message.recipient,
            message.kind,
            message.url,
          )
          .run();
      },
    },
  });
  return { env, auth, ...policy };
});
