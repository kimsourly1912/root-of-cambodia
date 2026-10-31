"use client";
import { useRef, useState, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type { OwnerBooking } from "@root-of-cambodia/backend/bookings";
import type { StayAction } from "@root-of-cambodia/backend/bookings";
import { Button } from "@/components/ui/button";
import { cambodiaTime } from "../../../lib/booking-format";
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
  if (!action) return null;
  async function apply(event: React.SubmitEvent<HTMLFormElement>) {
    event.preventDefault();
    if (now === null || busy.current || blocked || !action) return;
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
  }
  return (
    <section className="space-y-4 rounded-xl border p-6">
      <h2 className="text-xl font-semibold">
        {action === "check_in" ? "Record arrival" : "Complete the stay"}
      </h2>
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
      <form onSubmit={apply} className="space-y-4">
        <label className="flex gap-3 text-sm">
          <input
            type="checkbox"
            required
            className="mt-1 size-4 shrink-0"
            defaultChecked={!!intent}
            disabled={
              now === null ||
              pending ||
              uncertain ||
              blocked ||
              (action === "check_in" && !inWindow && !intent)
            }
          />
          <span>
            {action === "check_in"
              ? "The guest has arrived at the property."
              : "The guest has left and this stay is finished."}
          </span>
        </label>
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
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      )}
      {auth && (
        <Link
          className="block text-primary underline"
          href={`/sign-in?next=${encodeURIComponent(base + `?stayAction=${action}&stayAttempt=${key.current}`)}`}
        >
          Sign in and recover this update
        </Link>
      )}
      <a
        className="inline-block text-primary underline"
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
