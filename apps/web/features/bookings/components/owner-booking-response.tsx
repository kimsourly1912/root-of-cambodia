"use client";
import { useRef, useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "@tanstack/react-form";
import type {
  OwnerAttempt,
  OwnerBooking,
} from "@root-of-cambodia/backend/bookings";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { BookingLogistics } from "./booking-logistics";
import { SectionTitle } from "@/components/typography";
import { TextLink } from "@/components/text-link";
import { StatusMessage } from "@/components/status-message";
import { CheckboxField } from "@/components/ui/checkbox";
import { NativeSelect } from "@/components/ui/native-select";
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
  type ResponseAction = "accept" | "decline" | "cancel_owner";
  const [pending, setPending] = useState(false),
    [selectedAction, setAction] = useState<ResponseAction>(
      b.status === "pending" ? "accept" : "cancel_owner",
    ),
    [error, setError] = useState(""),
    [uncertain, setUncertain] = useState(false),
    [blocked, setBlocked] = useState(false),
    [auth, setAuth] = useState(false),
    [recovery, setRecovery] = useState(""),
    [now, setNow] = useState<number | null>(null);
  const form = useForm({
    defaultValues: {
      action: (b.status === "pending" ? "accept" : "cancel_owner") as ResponseAction,
      reason: "",
      reviewedDetails: false,
    },
    onSubmit: async ({ value }) => {
      if (busy.current) return;
      busy.current = true;
      setPending(true);
      setError("");
      let id = "";
      try {
        id = crypto.randomUUID();
        const responseAction = choices.includes(value.action)
          ? value.action
          : action;
        const r = await fetch(`/api/owner/bookings/${b.id}/attempts/${id}`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            action: responseAction,
            reason: value.reason,
            ...(responseAction === "accept"
              ? { acceptanceHash: b.preview?.hash }
              : {}),
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
          const result = (await r.json()) as { error: string };
          setAuth(r.status === 401 || r.status === 403);
          setError(responseError(result.error));
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
    },
  });
  useEffect(() => {
    const tick = () => setNow(Date.now() / 1000);
    tick();
    const timer = setInterval(tick, 10000);
    return () => clearInterval(timer);
  }, []);
  const choices = [
    ...(now !== null && b.status === "pending" && b.expiresAt > now
      ? ["accept", "decline"]
      : []),
    ...(now !== null &&
    ["pending", "confirmed"].includes(b.status) &&
    b.checkinAt > now
      ? ["cancel_owner"]
      : []),
  ] as ResponseAction[];
  const action = choices.includes(selectedAction)
    ? selectedAction
    : (choices[0] ?? "cancel_owner");
  useEffect(() => {
    // Empty choices before the clock loads must not replace the default accept action.
    if (now !== null && action !== selectedAction) {
      setAction(action);
      form.setFieldValue("action", action);
    }
  }, [action, form, now, selectedAction]);
  const label = (value: string) =>
    ({
      accept: "Accept and confirm stay",
      decline: "Decline request",
      cancel_owner: "Cancel booking",
    })[value] ?? value;
  const preview = attempt?.preview ?? b.preview;
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
  if (now === null && !attempt)
    return <StatusMessage tone="info">Loading booking actions…</StatusMessage>;
  if (!attempt && !choices.length)
    return (
      <p className="text-sm text-muted-foreground">
        No acceptance, decline or pre-check-in cancellation is available in this
        state.
      </p>
    );
  return (
    <section className="space-y-5 rounded-xl border p-6">
      <SectionTitle>
        {attempt ? "Review saved response" : "Respond to this booking"}
      </SectionTitle>
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
            <TextLink className="block" href={base}>
              {blocked ? "Reload current booking" : "Return without applying"}
            </TextLink>
          )}
        </div>
      ) : (
        <form
          onSubmit={(event) => {
            event.preventDefault();
            form.handleSubmit();
          }}
          className="space-y-5"
        >
          <fieldset disabled={pending || !!recovery} className="space-y-5">
            <div className="space-y-2">
              <Label htmlFor="booking-response">Response</Label>
              <form.Field name="action">
                {(field) => (
                  <NativeSelect
                    id="booking-response"
                    name={field.name}
                    value={action}
                    onBlur={field.handleBlur}
                    onChange={(event) => {
                      const next = event.target.value as ResponseAction;
                      field.handleChange(next);
                      setAction(next);
                    }}
                  >
                    {choices.map((value) => (
                      <option key={value} value={value}>
                        {label(value)}
                      </option>
                    ))}
                  </NativeSelect>
                )}
              </form.Field>
            </div>
            {action === "accept" && b.preview && (
              <>
                <BookingLogistics
                  details={b.preview.details}
                  heading="Details shared after confirmation"
                />
                {!b.preview.ready ? (
                  <StatusMessage tone="error">
                    A property address and at least one contact method are
                    required. Acceptance is unavailable until these details are
                    complete.
                  </StatusMessage>
                ) : (
                  <form.Field name="reviewedDetails">
                    {(field) => (
                      <CheckboxField
                        name={field.name}
                        checked={field.state.value}
                        onBlur={field.handleBlur}
                        onChange={(event) =>
                          field.handleChange(event.currentTarget.checked)
                        }
                        required
                      >
                        I reviewed the exact property details shown here and
                        will share this copy with the confirmed guest.
                      </CheckboxField>
                    )}
                  </form.Field>
                )}
              </>
            )}
            <div className="space-y-2">
              <Label htmlFor="response-reason">
                {action === "cancel_owner"
                  ? "Cancellation reason (required)"
                  : "Reason (optional)"}
              </Label>
              <form.Field name="reason">
                {(field) => (
                  <Textarea
                    id="response-reason"
                    name={field.name}
                    value={field.state.value}
                    onBlur={field.handleBlur}
                    onChange={(event) => field.handleChange(event.target.value)}
                    required={action === "cancel_owner"}
                    maxLength={2000}
                    rows={3}
                  />
                )}
              </form.Field>
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
        <StatusMessage tone="error">
          {error}
        </StatusMessage>
      )}
      {recovery && (
        <TextLink className="block"
         
          href={base + "?response=" + recovery}>
          Check saved response review
        </TextLink>
      )}
      {auth && (
        <TextLink className="block"
         
          href={`/sign-in?next=${encodeURIComponent(base + (attempt ? "?response=" + attempt.id : ""))}`}>
          Sign in and return to this response
        </TextLink>
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
