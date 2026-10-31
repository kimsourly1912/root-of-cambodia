"use client";
import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { requestError } from "./guest-request-form";
import { TextLink } from "@/components/text-link";
import { StatusMessage } from "@/components/status-message";
export function GuestCancel({
  id,
  checkinAt,
  attempt = "",
}: {
  id: string;
  checkinAt: number;
  attempt?: string;
}) {
  const router = useRouter(),
    key = useRef(attempt),
    busy = useRef(false);
  const [pending, setPending] = useState(false),
    [error, setError] = useState(""),
    [uncertain, setUncertain] = useState(!!attempt),
    [confirm, setConfirm] = useState(false),
    [auth, setAuth] = useState(false),
    [done, setDone] = useState(false);
  async function cancel() {
    if (busy.current || done) return;
    busy.current = true;
    setPending(true);
    setError("");
    if (!key.current) {
      key.current = crypto.randomUUID();
      window.history.replaceState(
        null,
        "",
        `/bookings/${id}?cancelAttempt=${key.current}`,
      );
    }
    try {
      const r = await fetch(`/api/bookings/${id}/cancel_guest`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Idempotency-Key": "guest-cancel:" + key.current,
        },
        body: "{}",
      });
      if (r.status >= 500) {
        setUncertain(true);
        setError(
          "Cancellation may have completed. Retry the same cancellation to recover its result.",
        );
        return;
      }
      if (!r.ok) {
        const value = (await r.json()) as { error?: string };
        setAuth(r.status === 401 || r.status === 403);
        setUncertain(true);
        setError(requestError(value.error));
        return;
      }
      setDone(true);
      router.replace(`/bookings/${id}`);
      router.refresh();
    } catch {
      setUncertain(true);
      setError("The connection was interrupted. Retry the same cancellation.");
    } finally {
      busy.current = false;
      setPending(false);
    }
  }
  if (!attempt && checkinAt <= Date.now() / 1000)
    return (
      <p>
        Online cancellation is unavailable after scheduled check-in. Arrival and
        late-cancellation handling are not available in this preview.
      </p>
    );
  return (
    <div className="space-y-3">
      {error && (
        <StatusMessage tone="error">
          {error}
        </StatusMessage>
      )}
      {auth && (
        <TextLink className="block"
          href={`/sign-in?next=${encodeURIComponent(`/bookings/${id}?cancelAttempt=${key.current}`)}`}>
          Sign in and recover cancellation
        </TextLink>
      )}
      {confirm || uncertain ? (
        <>
          <p className="text-sm">
            Cancel this request? Cancellation is free before scheduled check-in.
          </p>
          <Button type="button" disabled={pending || done} onClick={cancel}>
            {pending
              ? "Cancelling…"
              : uncertain
                ? "Retry same cancellation"
                : "Confirm cancellation"}
          </Button>
          {!uncertain && !pending && (
            <Button
              variant="outline"
              className="ml-3"
              onClick={() => setConfirm(false)}
            >
              Keep booking
            </Button>
          )}
        </>
      ) : (
        <Button
          type="button"
          variant="outline"
          onClick={() => setConfirm(true)}
        >
          Cancel request
        </Button>
      )}
    </div>
  );
}
