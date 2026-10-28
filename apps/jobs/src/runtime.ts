import type { Provider } from "@root-of-cambodia/backend/outbox";

export function requireLocal(env: JobsEnv) {
  if (env.APP_MODE !== "local")
    throw new Error("Jobs provider is not configured");
}

// This captures synthetic local delivery only. It cannot send real email.
// The stable key also deduplicates a local provider-success/acknowledgement retry.
export function localProvider(env: JobsEnv): Provider {
  requireLocal(env);
  return {
    send: async (message, options) => {
      await env.DB.prepare(
        "INSERT INTO local_notification(id,booking_id,kind,recipient) VALUES (?,?,?,?) ON CONFLICT(id) DO NOTHING",
      )
        .bind(
          options.idempotencyKey,
          message.bookingId,
          message.kind,
          message.email,
        )
        .run();
      return { id: "local:" + options.idempotencyKey };
    },
  };
}
