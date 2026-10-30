import { getCloudflareContext } from "@opennextjs/cloudflare";
import { makeAuth } from "@root-of-cambodia/backend/auth";
import { runtimePolicy } from "./runtime-policy";
export async function runtime() {
  const { env } = await getCloudflareContext({ async: true });
  const { readOnly } = runtimePolicy(env.APP_MODE, env.AUTH_URL);
  const auth = makeAuth(env.DB, {
    secret: env.BETTER_AUTH_SECRET,
    baseURL: env.AUTH_URL,
    mailer: {
      send: async (message) => {
        // Defense in depth: staged auth routes refuse activity before the
        // handler, and no live URL/token is ever stored as captured email.
        if (readOnly) throw new Error("Email delivery is unavailable");
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
  return { env, auth, readOnly };
}
