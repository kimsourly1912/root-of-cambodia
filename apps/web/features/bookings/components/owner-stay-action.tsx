"use client";
import { useRef, useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "@tanstack/react-form";
import type { OwnerBooking } from "@root-of-cambodia/backend/bookings";
import type { StayAction } from "@root-of-cambodia/backend/bookings";
import { Button } from "@/components/ui/button";
import { cambodiaTime } from "@/lib/booking-format";
import { SectionTitle } from "@/components/typography";
import { TextLink, textLinkClass } from "@/components/text-link";
import { StatusMessage } from "@/components/status-message";
import { CheckboxField } from "@/components/ui/checkbox";
import { cn } from "@/lib/utils";
export function OwnerStayAction({
  booking: b,
  intent,
}: {
  booking: OwnerBooking;
  intent: { action: StayAction; attempt: string } | null;
}) {
  const router = useRouter(),
    busy = useRef(false),
    key = useRef(intent?.attempt ?? "");
  const [pending, setPending] = useState(false),
    [uncertain, setUncertain] = useState(!!intent),
    [error, setError] = useState(""),
    [blocked, setBlocked] = useState(false),
    [auth, setAuth] = useState(false);
  const action =
      intent?.action ??
      (b.status === "confirmed"
        ? "check_in"
        : b.status === "checked_in"
          ? "complete"
          : null),
    base = `/owner/properties/${b.propertyId}/bookings/${b.id}`;
  const [now, setNow] = useState<number | null>(null);
  useEffect(() => {
    const tick = () => setNow(Date.now() / 1000);
    tick();
    const timer = setInterval(tick, 10000);
    return () => clearInterval(timer);
  }, []);
  const inWindow = now !== null && now >= b.checkinAt && now < b.checkoutAt;
  const form = useForm({
    defaultValues: { confirmed: !!intent },
    onSubmit: async ({ value }) => {
      if (now === null || busy.current || blocked || !action || !value.confirmed)
        return;
      busy.current = true;
      setPending(true);
      setError("");
      if (!key.current) {
        key.current = crypto.randomUUID();
        window.history.replaceState(
          null,
          "",
          base + `?stayAction=${action}&stayAttempt=${key.current}`,
        );
      }
      try {
        const r = await fetch(`/api/bookings/${b.id}/${action}`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Idempotency-Key": "stay:" + key.current,
          },
          body: "{}",
        });
        if (r.status >= 500) {
          setUncertain(true);
          setError(
            "We couldn’t confirm this update. Retry the same update to recover its result safely.",
          );
          return;
        }
        if (!r.ok) {
          setAuth(r.status === 401 || r.status === 403);
          if (r.status !== 401 && r.status !== 403) setBlocked(true);
          setUncertain(true);
          setError(
            "This update is unavailable with the current booking, schedule or account. Reload the booking to review its latest state.",
          );
          return;
        }
        setBlocked(true);
        router.replace(base);
        router.refresh();
      } catch {
        setUncertain(true);
        setError(
          "Connection interrupted. Retry the same update or reopen this booking to recover the result.",
        );
      } finally {
        busy.current = false;
        setPending(false);
      }
    },
  });
  if (!action) return null;
  return (
    <section className="space-y-4 rounded-xl border p-6">
      <SectionTitle>
        {action === "check_in" ? "Record arrival" : "Complete the stay"}
      </SectionTitle>
      {action === "check_in" ? (
        <p className="text-sm">
          Record arrival from {cambodiaTime(b.checkinAt)} until{" "}
          {cambodiaTime(b.checkoutAt)} Cambodia time. This records your
          confirmation that the guest is here.
        </p>
      ) : (
        <p className="text-sm">
          Record completion when the guest has left. The booked dates, total and
          reserved nights remain unchanged. Payment records are separate.
        </p>
      )}
      {action === "check_in" && !inWindow && !intent && (
        <p className="text-sm">
          Arrival recording is outside the booked time window. No automatic
          no-show or cancellation has been applied.
        </p>
      )}
      <form
        onSubmit={(event) => {
          event.preventDefault();
          form.handleSubmit();
        }}
        className="space-y-4"
      >
        <form.Field name="confirmed">
          {(field) => (
            <CheckboxField
              name={field.name}
              checked={field.state.value}
              onBlur={field.handleBlur}
              onChange={(event) =>
                field.handleChange(event.currentTarget.checked)
              }
              required
              disabled={
                now === null ||
                pending ||
                uncertain ||
                blocked ||
                (action === "check_in" && !inWindow && !intent)
              }
            >
              {action === "check_in"
                ? "The guest has arrived at the property."
                : "The guest has left and this stay is finished."}
            </CheckboxField>
          )}
        </form.Field>
        {!blocked && (
          <Button
            type="submit"
            disabled={
              now === null || pending || (action === "check_in" && !inWindow && !intent)
            }
          >
            {pending
              ? "Saving update…"
              : uncertain
                ? "Retry same stay update"
                : action === "check_in"
                  ? "Mark guest checked in"
                  : "Mark stay completed"}
          </Button>
        )}
      </form>
      {error && (
        <StatusMessage tone="error">
          {error}
        </StatusMessage>
      )}
      {auth && (
        <TextLink className="block"
         
          href={`/sign-in?next=${encodeURIComponent(base + `?stayAction=${action}&stayAttempt=${key.current}`)}`}>
          Sign in and recover this update
        </TextLink>
      )}
      <a
        className={cn(textLinkClass, "inline-block")}
        href={
          base +
          (key.current
            ? `?stayAction=${action}&stayAttempt=${key.current}`
            : "")
        }
      >
        Refresh and check result
      </a>
    </section>
  );
}
