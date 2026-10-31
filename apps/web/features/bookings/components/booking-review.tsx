"use client";
import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import type { GuestQuote } from "@root-of-cambodia/backend/bookings";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { usd, cambodiaTime } from "@/lib/booking-format";
import { requestError } from "./guest-request-form";
import { SectionTitle } from "@/components/typography";
import { TextLink } from "@/components/text-link";
import { StatusMessage } from "@/components/status-message";
import { CheckboxField } from "@/components/ui/checkbox";
export function BookingReview({
  id,
  preview: q,
}: {
  id: string;
  preview: GuestQuote;
}) {
  const router = useRouter(),
    busy = useRef(false);
  const [pending, setPending] = useState(false),
    [uncertain, setUncertain] = useState(false),
    [error, setError] = useState(""),
    [blocked, setBlocked] = useState(false),
    [auth, setAuth] = useState(false);
  async function send(event: React.SubmitEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy.current || blocked) return;
    busy.current = true;
    setPending(true);
    setError("");
    try {
      const r = await fetch(`/api/guest/attempts/${id}/send`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ acceptedTerms: true }),
      });
      if (r.status >= 500) {
        setUncertain(true);
        setError(
          "We couldn’t confirm the result. Retry this same request to recover it safely. Do not start another request.",
        );
        return;
      }
      const result = (await r.json()) as { error?: string; id: string };
      if (!r.ok) {
        if (r.status === 401 || r.status === 403) {
          setAuth(true);
          setUncertain(true);
        } else {
          setBlocked(true);
          setUncertain(false);
        }
        setError(requestError(result.error));
        return;
      }
      setBlocked(true);
      router.replace(`/bookings/${result.id}`);
      router.refresh();
    } catch {
      setUncertain(true);
      setError(
        "The connection was interrupted. Retry the same request or return to this saved review after signing in.",
      );
    } finally {
      busy.current = false;
      setPending(false);
    }
  }
  return (
    <div className="grid items-start gap-7 lg:grid-cols-[minmax(0,1fr)_300px]">
      <div className="min-w-0 space-y-6">
        <Card>
          <CardHeader>
            <CardTitle>{q.propertyName}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-5">
            <p>
              {cambodiaTime(q.checkinAt)} → {cambodiaTime(q.checkoutAt)} ·
              Cambodia time
            </p>
            {q.lines.map((line) => (
              <section
                key={line.selection.roomId}
                className="space-y-2 border-t pt-4"
              >
                <SectionTitle size="sm">{line.roomName}</SectionTitle>
                <p className="text-sm">
                  {line.selection.quantity} units · {line.selection.adults}{" "}
                  adults · {line.selection.children} children
                </p>
                <ul className="space-y-2 text-sm">
                  {line.rates.map((rate) => (
                    <li
                      key={rate.night}
                      className="flex flex-wrap justify-between gap-2"
                    >
                      <span>
                        {rate.night} · {line.selection.quantity} ×{" "}
                        {usd(rate.unitCents)}
                      </span>
                      <span>
                        {usd(rate.unitCents * line.selection.quantity)}
                      </span>
                    </li>
                  ))}
                </ul>
              </section>
            ))}
            {q.charges.map((c) => (
              <p
                key={c.code}
                className="flex flex-wrap justify-between gap-2 text-sm"
              >
                <span>{c.label}</span>
                <span>{usd(c.amountCents)}</span>
              </p>
            ))}
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Rules and booking terms</CardTitle>
          </CardHeader>
          <CardContent className="space-y-5">
            <p className="whitespace-pre-wrap">{q.policy.text}</p>
            <p>{q.cancellation}</p>
            <div className="rounded-md bg-secondary p-4">
              <p className="mb-3 text-sm font-medium">
                Booking terms · {q.terms.version}
              </p>
              <p className="whitespace-pre-wrap">{q.terms.content}</p>
            </div>
            <p className="text-sm text-muted-foreground">
              Exact address, property contact and arrival instructions become
              available after confirmation. No room is held while the owner
              considers your request.
            </p>
          </CardContent>
        </Card>
      </div>
      <Card className="lg:sticky lg:top-8">
        <CardHeader>
          <CardTitle>Review your request</CardTitle>
        </CardHeader>
        <CardContent className="space-y-5">
          <p className="text-2xl font-semibold">{usd(q.totalCents)}</p>
          <p>$0 due now · Pay at the property</p>
          <p className="text-sm">
            The owner has 12 hours to respond after submission. A successful
            request means Pending confirmation.
          </p>
          <form onSubmit={send} className="space-y-5">
            <CheckboxField
               
               
                required
                disabled={pending || uncertain || blocked}
                defaultChecked={uncertain}>
                I accept booking terms {q.terms.version}, the house rules and
                cancellation policy shown here.
              </CheckboxField>
            {error && (
              <StatusMessage tone="error">
                {error}
              </StatusMessage>
            )}
            {auth && (
              <TextLink className="block"
               
                href={`/sign-in?next=${encodeURIComponent(`/bookings/requests/${id}`)}`}>
                Sign in and recover this request
              </TextLink>
            )}
            {!blocked && (
              <Button className="w-full" disabled={pending} type="submit">
                {pending
                  ? "Sending request…"
                  : uncertain
                    ? "Retry same request"
                    : "Send request to owner"}
              </Button>
            )}
          </form>
          {!uncertain && (
            <TextLink className="block text-sm"
              href={`/stays/${q.input.propertyId}/request`}>
              {blocked ? "Review a fresh request" : "Change selection"}
            </TextLink>
          )}
          <p className="text-xs text-muted-foreground">
            This review is saved to your account. Opening it again recovers the
            same attempt.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
