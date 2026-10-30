// These are API codes, not raw provider/database messages. Add new codes deliberately.
export const ERROR_CODES = [
  "arrival_policy_decision_required",
  "acceptance_preview_required",
  "acceptance_preview_changed",
  "acceptance_incomplete",
  "booking_conflict",
  "confirmation_required",
  "invalid_payment",
  "booking_terms_unavailable",
  "booking_terms_required",
  "guest_name_required",
  "lead_time_required",
  "duplicate_room_type",
  "forbidden",
  "idempotency_conflict",
  "incomplete_rates",
  "infant_policy_decision_required",
  "invalid_action",
  "invalid_dates",
  "invalid_idempotency_key",
  "invalid_inventory",
  "invalid_json",
  "invalid_limit",
  "invalid_occupancy",
  "invalid_property_charges",
  "invalid_property",
  "invalid_property_information",
  "invalid_property_logistics",
  "invalid_photo",
  "photo_processing_unavailable",
  "invalid_room_type",
  "invalid_calendar",
  "invalid_reason",
  "invalid_request",
  "invalid_review",
  "invalid_listing_control",
  "listing_conflict",
  "listing_resume_unavailable",
  "review_conflict",
  "reviewer_not_configured",
  "publication_terms_not_configured",
  "publication_incomplete",
  "public_disclosure_required",
  "public_disclosure_changed",
  "unfinished_photos",
  "inventory_unavailable",
  "not_found",
  "occupancy_exceeded",
  "operation_incomplete",
  "owner_reason_required",
  "quote_changed",
  "quote_required",
  "quote_size_limit",
  "request_size_limit",
  "request_too_large",
  "retry_same_operation",
  "room_unavailable",
  "temporarily_unavailable_retry_same_key",
  "terms_changed",
  "unauthorized",
  "verified_session_required",
] as const;
export type ErrorCode = (typeof ERROR_CODES)[number];
const ERROR_STATUSES = [401, 403, 404, 409, 413, 422, 503] as const;
export type ErrorStatus = (typeof ERROR_STATUSES)[number];
const DOMAIN_FAILURE_REASONS = [
  "domain_rejection",
  "database_guard_rejected",
  "inventory_unavailable",
  "snapshot_rejected",
  "deadline_rejected",
  "actor_rejected",
] as const;
type DomainFailureReason = (typeof DOMAIN_FAILURE_REASONS)[number];
export type FailureReason =
  | DomainFailureReason
  | "unexpected_failure"
  | "jobs_not_configured";
export class DomainError extends Error {
  constructor(
    public code: ErrorCode,
    public status: ErrorStatus = 409,
    public diagnostic: DomainFailureReason = "domain_rejection",
  ) {
    super(code);
  }
}
export class JobsConfigurationError extends Error {
  constructor() {
    super("Jobs provider is not configured");
  }
}
// Classification is only an operator hint. It never replaces database guards or
// receipt recovery, and never emits the original message, cause, SQL or stack.
export function databaseFailureReason(error: unknown): DomainFailureReason {
  const message = error instanceof Error ? error.message : "";
  if (/\b(missing_inventory)\b/i.test(message)) return "inventory_unavailable";
  if (
    /\b(incomplete_nights|empty_lines|immutable_snapshot|invalid_booking_schedule)\b/i.test(
      message,
    )
  )
    return "snapshot_rejected";
  if (
    /\b(request_expired|not_due|lead_time|cancellation_cutoff)\b/i.test(message)
  )
    return "deadline_rejected";
  if (/\b(invalid_actor)\b/i.test(message)) return "actor_rejected";
  return "database_guard_rejected";
}
export function safeFailure(error: unknown): {
  code: ErrorCode;
  status: ErrorStatus;
  reason: FailureReason;
} {
  if (
    error instanceof DomainError &&
    ERROR_CODES.includes(error.code) &&
    ERROR_STATUSES.includes(error.status)
  ) {
    return {
      code: error.code,
      status: error.status,
      reason: DOMAIN_FAILURE_REASONS.includes(error.diagnostic)
        ? error.diagnostic
        : "domain_rejection",
    };
  }
  return {
    code: "temporarily_unavailable_retry_same_key",
    status: 503,
    reason:
      error instanceof JobsConfigurationError
        ? "jobs_not_configured"
        : "unexpected_failure",
  };
}
