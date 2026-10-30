"use client";
import { useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type {
  OwnerAttempt,
  OwnerBooking,
} from "@root-of-cambodia/backend/owner-bookings";
import { Button } from "./ui/button";
import { Label } from "./ui/label";
import { Textarea } from "./ui/textarea";
import { BookingLogistics } from "./booking-logistics";
export function OwnerBookingResponse({
  booking: b,
  attempt,
}: {
  booking: OwnerBooking;
  attempt: OwnerAttempt | null;
}) {
  const router = useRouter(),
    busy = useRef(false),
    base = `/owner/properties/${b.propertyId}/bookings/${b.id}`;
  const [action, setAction] = useState(
      b.status === "pending" && b.expiresAt > Date.now() / 1000
        ? "accept"
        : "cancel_owner",
    ),
    [pending, setPending] = useState(false),
    [error, setError] = useState(""),
    [uncertain, setUncertain] = useState(false),
    [blocked, setBlocked] = useState(false),
    [auth, setAuth] = useState(false),
    [recovery, setRecovery] = useState("");
  const choices = [
    ...(b.status === "pending" && b.expiresAt > Date.now() / 1000
      ? ["accept", "decline"]
      : []),
    ...(["pending", "confirmed"].includes(b.status) &&
    b.checkinAt > Date.now() / 1000
      ? ["cancel_owner"]
      : []),
  ];
  const label = (value: string) =>
    ({
      accept: "Accept and confirm stay",
      decline: "Decline request",
      cancel_owner: "Cancel booking",
    })[value] ?? value;
  const preview = attempt?.preview ?? b.preview;
  async function review(event: React.SubmitEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy.current) return;
    busy.current = true;
    setPending(true);
    setError("");
    let id = "";
    try {
      const data = new FormData(event.currentTarget);
      id = crypto.randomUUID();
      const r = await fetch(`/api/owner/bookings/${b.id}/attempts/${id}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action,
          reason: String(data.get("reason") ?? ""),
          ...(action === "accept" ? { acceptanceHash: b.preview?.hash } : {}),
        }),
      });
      if (r.status >= 500) {
        setRecovery(id);
        setError(
          "We couldn’t confirm whether this response review was saved. Open the saved review before starting again. No booking change has been requested yet.",
        );
        return;
      }
      if (!r.ok) {
        const value = (await r.json()) as { error: string };
        setAuth(r.status === 401 || r.status === 403);
        setError(responseError(value.error));
        return;
      }
      router.push(base + "?response=" + id);
      router.refresh();
    } catch {
      if (id) setRecovery(id);
      setError(
        "Connection interrupted while preparing this response. Open its saved review to check the result.",
      );
    } finally {
      busy.current = false;
      setPending(false);
    }
  }
  async function apply() {
    if (!attempt || busy.current || blocked) return;
    busy.current = true;
    setPending(true);
    setError("");
    try {
      const r = await fetch(
        `/api/owner/bookings/${b.id}/attempts/${attempt.id}/apply`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: "{}",
        },
      );
      if (r.status >= 500) {
        setUncertain(true);
        setError(
          "We couldn’t confirm the result. Retry this same response to recover its receipt safely.",
        );
        return;
      }
      if (!r.ok) {
        const value = (await r.json()) as { error: string };
        setAuth(r.status === 401 || r.status === 403);
        if (r.status !== 401 && r.status !== 403) setBlocked(true);
        setError(responseError(value.error));
        return;
      }
      setBlocked(true);
      router.replace(base);
      router.refresh();
    } catch {
      setUncertain(true);
      setError(
        "Connection interrupted. Retry the same response or reopen this saved review after signing in.",
      );
    } finally {
      busy.current = false;
      setPending(false);
    }
  }
  if (!attempt && !choices.length)
    return (
      <p className="text-sm text-muted-foreground">
        No supported online response is available in this state. Arrival,
        no-show and post-check-in handling are not available in this preview.
      </p>
    );
  return (
    <section className="space-y-5 rounded-xl border p-6">
      <h2 className="text-xl font-semibold">
        {attempt ? "Review saved response" : "Respond to this booking"}
      </h2>
      {attempt ? (
        <div className="space-y-5">
          <p className="font-semibold">{label(attempt.action)}</p>
          {attempt.reason && (
            <p className="whitespace-pre-wrap">Reason: {attempt.reason}</p>
          )}
          {attempt.action === "accept" && preview && (
            <>
              <BookingLogistics
                details={preview.details}
                heading="The exact details you will share"
              />
              <p className="text-sm">
                These details and all room allocations will be saved together
                when acceptance succeeds. Later property changes will not
                rewrite this copy.
              </p>
            </>
          )}
          {!blocked && (
            <Button type="button" disabled={pending} onClick={apply}>
              {pending
                ? "Applying response…"
                : uncertain
                  ? "Retry same response"
                  : label(attempt.action)}
            </Button>
          )}
          {!uncertain && (
            <Link className="block text-primary underline" href={base}>
              {blocked ? "Reload current booking" : "Return without applying"}
            </Link>
          )}
        </div>
      ) : (
        <form onSubmit={review} className="space-y-5">
          <fieldset disabled={pending || !!recovery} className="space-y-5">
            <div className="space-y-2">
              <Label htmlFor="booking-response">Response</Label>
              <select
                id="booking-response"
                value={action}
                onChange={(e) => setAction(e.target.value)}
                className="h-10 w-full rounded-md border bg-background px-3 text-sm"
              >
                {choices.map((value) => (
                  <option key={value} value={value}>
                    {label(value)}
                  </option>
                ))}
              </select>
            </div>
            {action === "accept" && b.preview && (
              <>
                <BookingLogistics
                  details={b.preview.details}
                  heading="Details shared after confirmation"
                />
                {!b.preview.ready ? (
                  <p role="alert" className="text-sm text-destructive">
                    A property address and at least one contact method are
                    required. Acceptance is unavailable until these details are
                    complete.
                  </p>
                ) : (
                  <label className="flex gap-3 text-sm">
                    <input
                      required
                      type="checkbox"
                      className="mt-1 size-4 shrink-0"
                    />
                    <span>
                      I reviewed the exact property details shown here and will
                      share this copy with the confirmed guest.
                    </span>
                  </label>
                )}
              </>
            )}
            <div className="space-y-2">
              <Label htmlFor="response-reason">
                {action === "cancel_owner"
                  ? "Cancellation reason (required)"
                  : "Reason (optional)"}
              </Label>
              <Textarea
                id="response-reason"
                name="reason"
                required={action === "cancel_owner"}
                maxLength={2000}
                rows={3}
              />
            </div>
          </fieldset>
          {!recovery && (
            <Button
              type="submit"
              disabled={pending || (action === "accept" && !b.preview?.ready)}
            >
              {pending ? "Preparing review…" : "Review response"}
            </Button>
          )}
        </form>
      )}
      {error && (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      )}
      {recovery && (
        <Link
          className="block text-primary underline"
          href={base + "?response=" + recovery}
        >
          Check saved response review
        </Link>
      )}
      {auth && (
        <Link
          className="block text-primary underline"
          href={`/sign-in?next=${encodeURIComponent(base + (attempt ? "?response=" + attempt.id : ""))}`}
        >
          Sign in and return to this response
        </Link>
      )}
    </section>
  );
}
function responseError(code: string) {
  return (
    (
      {
        acceptance_preview_changed:
          "The property details changed after this review. Reload the booking and review the new details before preparing a new response.",
        acceptance_preview_required:
          "Review the exact property details before accepting.",
        acceptance_incomplete:
          "A property address and contact method are required before acceptance.",
        booking_conflict:
          "The booking, deadline or remaining stock changed. Reload the current booking before preparing another response.",
        owner_reason_required: "Enter a cancellation reason.",
        invalid_reason: "Keep the reason within 2,000 characters.",
        not_found:
          "This booking or saved response is no longer available to your account.",
        idempotency_conflict:
          "This review already has different saved details. Open the original saved response.",
        unauthorized:
          "Your session expired. Sign in again and return to this saved response.",
        verified_session_required: "Verify your email, then sign in again.",
      } as Record<string, string>
    )[code] ??
    "We couldn’t apply this response. Reload the booking to check its current state."
  );
}
