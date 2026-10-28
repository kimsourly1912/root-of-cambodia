import { safeFailure, type ErrorCode, type FailureReason } from "./errors";
import { digest } from "./operations";
import type { DeliveryOutcome } from "./outbox";

type Source = "http" | "jobs_scheduled" | "jobs_queue";
type ResultCode = DeliveryOutcome | "discarded";
export type DiagnosticRecord = {
  version: 1;
  source: Source;
  correlationId: string;
  event: "failure" | "completed" | "notification_result";
  code: ErrorCode | ResultCode | "request_completed" | "maintenance_completed";
  reason?: FailureReason;
  status?: number;
  reference?: string;
};
export type DiagnosticSink = (record: DiagnosticRecord) => void;
const defaultSink: DiagnosticSink = (record) =>
  console.log(JSON.stringify(record));

// Queue IDs currently contain recipient references. Never log them directly.
// A namespaced digest gives retries an opaque stable reference without adding
// guest data, provider IDs, idempotency keys or lease tokens to the log schema.
export async function notificationReference(message: unknown) {
  try {
    if (
      !message ||
      typeof message !== "object" ||
      !("id" in message) ||
      typeof message.id !== "string" ||
      message.id.length > 200
    )
      return undefined;
    return await digest({ kind: "notification-diagnostic", id: message.id });
  } catch {
    return undefined;
  } // Diagnostics must not prevent queue recovery.
}

export function diagnostics(
  source: Source,
  sink: DiagnosticSink = defaultSink,
) {
  // Generated here, never copied from an untrusted request header or message.
  const correlationId = crypto.randomUUID();
  const emit = (
    fields: Pick<DiagnosticRecord, "event" | "code"> &
      Partial<Pick<DiagnosticRecord, "reason" | "status" | "reference">>,
  ) => {
    const reference =
      fields.reference && /^[a-f0-9]{64}$/.test(fields.reference)
        ? fields.reference
        : undefined;
    const record: DiagnosticRecord = {
      version: 1,
      source,
      correlationId,
      event: fields.event,
      code: fields.code,
      ...(fields.reason ? { reason: fields.reason } : {}),
      ...(fields.status ? { status: fields.status } : {}),
      ...(reference ? { reference } : {}),
    };
    try {
      sink(record);
    } catch {
      /* A log failure cannot change a committed outcome. */
    }
  };
  return {
    correlationId,
    failure(error: unknown, reference?: string) {
      const failure = safeFailure(error);
      emit({
        event: "failure",
        code: failure.code,
        reason: failure.reason,
        status: failure.status,
        reference,
      });
      return failure;
    },
    completed() {
      emit({
        event: "completed",
        code: source === "http" ? "request_completed" : "maintenance_completed",
        ...(source === "http" ? { status: 200 } : {}),
      });
    },
    notification(
      result: { outcome: DeliveryOutcome } | { discarded: true },
      reference?: string,
    ) {
      emit({
        event: "notification_result",
        code: "discarded" in result ? "discarded" : result.outcome,
        reference,
      });
    },
  };
}
