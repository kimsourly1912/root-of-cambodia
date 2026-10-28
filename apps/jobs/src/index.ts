import { maintenance, consume } from "@root-of-cambodia/backend/jobs";
import { localProvider, requireLocal } from "./runtime";

export default {
  async scheduled(_controller, env) {
    requireLocal(env);
    await maintenance(env.DB, env.NOTIFICATIONS);
  },
  async queue(batch, env) {
    // Reject the whole batch before acknowledging anything outside local mode.
    const provider = localProvider(env);
    for (const message of batch.messages) {
      try {
        await consume(env.DB, message.body, provider);
        // Success, duplicate, discarded input, or a durably recorded backoff:
        // the outbox sweep remains responsible for due/expired-lease recovery.
        message.ack();
      } catch {
        // An uncertain database result must remain retryable with the same ID.
        message.retry();
      }
    }
  },
} satisfies ExportedHandler<JobsEnv>;
