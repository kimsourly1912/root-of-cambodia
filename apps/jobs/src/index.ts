import { maintenance, consume } from "@root-of-cambodia/backend/jobs";
import {
  diagnostics,
  notificationReference,
} from "@root-of-cambodia/backend/diagnostics";
import { JobsConfigurationError } from "@root-of-cambodia/backend/errors";
import { localProvider, requireLocal } from "./runtime";

export default {
  async scheduled(_controller, env) {
    const context = diagnostics("jobs_scheduled");
    try {
      requireLocal(env);
      await maintenance(env.DB, env.NOTIFICATIONS);
      context.completed();
    } catch (error) {
      const failure = context.failure(error);
      // Runtime exception logs must not receive the raw queue/database error.
      throw failure.reason === "jobs_not_configured"
        ? new JobsConfigurationError()
        : new Error("jobs_maintenance_failed");
    }
  },
  async queue(batch, env) {
    // Reject the whole batch before acknowledging anything outside local mode.
    let provider;
    try {
      provider = localProvider(env);
    } catch (error) {
      diagnostics("jobs_queue").failure(error);
      throw new JobsConfigurationError();
    }
    for (const message of batch.messages) {
      const context = diagnostics("jobs_queue");
      const reference = await notificationReference(message.body);
      try {
        const result = await consume(env.DB, message.body, provider);
        context.notification(result, reference);
        // Success, duplicate, discarded input, or a durably recorded backoff:
        // the outbox sweep remains responsible for due/expired-lease recovery.
        message.ack();
      } catch (error) {
        context.failure(error, reference);
        // An uncertain database result must remain retryable with the same ID.
        message.retry();
      }
    }
  },
} satisfies ExportedHandler<JobsEnv>;
