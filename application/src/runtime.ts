import { getCloudflareContext } from "@opennextjs/cloudflare";
import { makeAuth } from "./auth";
export async function runtime() {
  const { env } = await getCloudflareContext({ async: true });
  // Deliberately fail closed until a sending domain/provider has been selected.
  if (
    env.APP_MODE !== "local" ||
    !["http://127.0.0.1:8787", "http://localhost:8787"].includes(env.AUTH_URL)
  )
    throw new Error("Email provider is not configured");
  const auth = makeAuth(env.DB, {
    secret: env.BETTER_AUTH_SECRET,
    baseURL: env.AUTH_URL,
    mailer: {
      send: async (message) => {
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
  return { env, auth };
}
