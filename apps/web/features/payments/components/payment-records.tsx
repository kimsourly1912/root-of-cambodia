"use client";
import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import type { OwnerPayments } from "@root-of-cambodia/backend/payments";
import type { PaymentAttempt } from "@root-of-cambodia/backend/payments";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { usd, cambodiaTime } from "@/lib/booking-format";
import { SectionTitle } from "@/components/typography";
import { TextLink } from "@/components/text-link";
import { StatusMessage } from "@/components/status-message";
import { CheckboxField } from "@/components/ui/checkbox";
export function PaymentRecords({
  bookingId,
  base,
  state,
  attempt,
}: {
  bookingId: string;
  base: string;
  state: OwnerPayments;
  attempt: PaymentAttempt | null;
}) {
  const router = useRouter(),
    busy = useRef(false);
  const [hydrated, setHydrated] = useState(false),
    [pending, setPending] = useState(false),
    [error, setError] = useState(""),
    [uncertain, setUncertain] = useState(false),
    [auth, setAuth] = useState(false),
    [blocked, setBlocked] = useState(false),
    [recovery, setRecovery] = useState("");
  useEffect(() => setHydrated(true), []);
  const action =
    attempt?.action ?? (state.status === "recorded" ? "void" : "record");
  const eligible =
    state.totalCents > 0 &&
    (action === "void" ||
      ["checked_in", "completed"].includes(state.bookingStatus));
  const api = `/api/owner/bookings/${bookingId}/payments/attempts/`;
  const currentAttempt = attempt?.id ?? recovery;
  async function review(event: React.SubmitEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!hydrated || busy.current) return;
    busy.current = true;
    setPending(true);
    setError("");
    let id = "";
    try {
      const values = new FormData(event.currentTarget);
      id = crypto.randomUUID();
      const r = await fetch(api + id, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action,
          revision: state.revision,
          ...(action === "void"
            ? { reason: String(values.get("reason") ?? "") }
            : {}),
        }),
      });
      if (r.status >= 500) {
        setRecovery(id);
        setError(
          "We couldn’t confirm whether the review was saved. Check its saved review before starting again. Preparing a review never records or voids a payment.",
        );
        return;
      }
      if (!r.ok) {
        setAuth(r.status === 401 || r.status === 403);
        setError(
          "This record changed or the input is incomplete. Reload the current payment record before preparing another review.",
        );
        return;
      }
      router.push(base + "?paymentAttempt=" + id);
      router.refresh();
    } catch {
      if (id) setRecovery(id);
      setError(
        "Connection interrupted while saving the review. Check its saved review; no payment change has been requested yet.",
      );
    } finally {
      busy.current = false;
      setPending(false);
    }
  }
  async function apply() {
    if (!hydrated || !attempt || busy.current || blocked) return;
    busy.current = true;
    setPending(true);
    setError("");
    try {
      const r = await fetch(api + attempt.id + "/apply", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: "{}",
      });
      if (r.status >= 500) {
        setUncertain(true);
        setError(
          "We couldn’t confirm the result. Retry the same payment update to recover its receipt.",
        );
        return;
      }
      if (!r.ok) {
        setAuth(r.status === 401 || r.status === 403);
        if (r.status !== 401 && r.status !== 403) setBlocked(true);
        setError(
          "The payment record or your access changed. Reload the current record before making a new deliberate update.",
        );
        return;
      }
      setBlocked(true);
      router.replace(base);
      router.refresh();
    } catch {
      setUncertain(true);
      setError(
        "Connection interrupted. Retry the same payment update or reopen this saved review after signing in.",
      );
    } finally {
      busy.current = false;
      setPending(false);
    }
  }
  return (
    <section className="space-y-5 rounded-xl border p-6">
      <SectionTitle>Payment at the property</SectionTitle>
      <p className="font-medium">
        {state.status === "recorded"
          ? "Payment recorded"
          : state.status === "no_payment_due"
            ? "No payment due"
            : "Payment not recorded"}
      </p>
      {state.status === "recorded" && (
        <p>
          {usd(state.amountCents)} · Recorded at{" "}
          {cambodiaTime(state.recordedAt!)} Cambodia time
        </p>
      )}
      <p className="text-sm text-muted-foreground">
        This is your property’s bookkeeping. The platform does not collect or
        independently verify money. No record is not proof that a guest has not
        paid.
      </p>
      {attempt ? (
        <div className="space-y-4 rounded-lg bg-secondary p-4">
          <SectionTitle as="h3" size="sm">Review saved payment update</SectionTitle>
          <p>
            {action === "record"
              ? `Record the full ${usd(state.totalCents)} received outside this platform.`
              : "Void the mistaken payment record. This does not refund money or create a new debt."}
          </p>
          {attempt.reason && (
            <p className="whitespace-pre-wrap">
              Owner-private correction reason: {attempt.reason}
            </p>
          )}
          {!blocked && (
            <Button onClick={apply} disabled={!hydrated || pending}>
              {pending
                ? "Saving payment update…"
                : uncertain
                  ? "Retry same payment update"
                  : action === "record"
                    ? "Record full payment"
                    : "Void mistaken record"}
            </Button>
          )}
          {!uncertain && (
            <TextLink className="block" href={base}>
              Return to current payment record
            </TextLink>
          )}
        </div>
      ) : eligible ? (
        <form onSubmit={review} className="space-y-4">
          <CheckboxField
              required
             
             
              disabled={!hydrated || pending || !!recovery}>
              {action === "record"
                ? `The property received the full ${usd(state.totalCents)} outside this platform.`
                : "I am correcting a mistaken record. This does not refund money or establish a new debt."}
            </CheckboxField>
          {action === "void" && (
            <div className="space-y-2">
              <Label htmlFor="payment-correction-reason">
                Correction reason (owner-private)
              </Label>
              <Textarea
                required
                maxLength={2000}
                id="payment-correction-reason"
                name="reason"
                disabled={!hydrated || pending || !!recovery}
              />
            </div>
          )}
          {!recovery && (
            <Button type="submit" disabled={!hydrated || pending}>
              {pending
                ? "Preparing review…"
                : action === "record"
                  ? "Review payment record"
                  : "Review correction"}
            </Button>
          )}
        </form>
      ) : state.totalCents > 0 ? (
        <p className="text-sm">
          Full payment can be recorded after arrival or completion. Partial
          payments, deposits and refunds are not available here.
        </p>
      ) : null}
      {error && (
        <StatusMessage tone="error">
          {error}
        </StatusMessage>
      )}
      {recovery && (
        <TextLink className="block"
          href={base + "?paymentAttempt=" + recovery}>
          Check saved payment review
        </TextLink>
      )}
      {auth && (
        <TextLink className="block"
          href={`/sign-in?next=${encodeURIComponent(base + (currentAttempt ? "?paymentAttempt=" + currentAttempt : ""))}`}>
          Sign in and recover this payment update
        </TextLink>
      )}
      {!attempt && !!state.drafts.length && (
        <div className="space-y-2">
          <SectionTitle as="h3" size="sm">Saved payment reviews</SectionTitle>
          {state.drafts.map((d) => (
            <TextLink className="block text-sm"
              key={d.id}
              href={base + "?paymentAttempt=" + d.id}>
              Open saved {d.action === "record" ? "payment" : "correction"}{" "}
              review
            </TextLink>
          ))}
        </div>
      )}
      {!!state.events.length && (
        <div className="space-y-3 border-t pt-5">
          <SectionTitle as="h3" size="sm">Payment record history</SectionTitle>
          {state.events.map((e) => (
            <div
              key={e.revision}
              className="rounded-md bg-secondary p-3 text-sm"
            >
              <p>
                {e.kind === "record"
                  ? "Full payment recorded"
                  : "Mistaken record voided"}{" "}
                · {usd(e.amountCents)} · {cambodiaTime(e.occurredAt)}
              </p>
              {e.reason && (
                <p className="mt-2 whitespace-pre-wrap">
                  Owner-private reason: {e.reason}
                </p>
              )}
            </div>
          ))}
          <div className="flex gap-5">
            <TextLink href={base}>
              Latest payment history
            </TextLink>
            {state.nextCursor && (
              <TextLink
               
                href={base + "?paymentCursor=" + state.nextCursor}>
                Older payment history
              </TextLink>
            )}
          </div>
        </div>
      )}
    </section>
  );
}
export function GuestPaymentRecord({
  payment,
}: {
  payment: {
    status: string;
    amountCents: number;
    recordedAt: number | null;
    changedAt: number | null;
  };
}) {
  return (
    <section className="space-y-3 rounded-xl border p-6">
      <SectionTitle>Payment at the property</SectionTitle>
      <p className="font-medium">
        {payment.status === "recorded"
          ? "Property marked full payment recorded"
          : payment.status === "no_payment_due"
            ? "No payment due"
            : "Payment not recorded"}
      </p>
      {payment.status === "recorded" && (
        <p>
          {usd(payment.amountCents)} · Recorded at{" "}
          {cambodiaTime(payment.recordedAt!)} Cambodia time
        </p>
      )}
      {payment.status === "not_recorded" && payment.changedAt !== null && (
        <p className="text-sm">
          Property bookkeeping last changed at {cambodiaTime(payment.changedAt)}{" "}
          Cambodia time.
        </p>
      )}
      <p className="text-sm text-muted-foreground">
        Payment is handled directly by the property. This platform does not
        collect or independently verify money; no record is not proof of
        nonpayment.
      </p>
    </section>
  );
}
