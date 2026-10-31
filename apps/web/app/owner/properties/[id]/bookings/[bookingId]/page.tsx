import { notFound, redirect } from "next/navigation";
import { ownerSession, ownerRead } from "@/server/owner-session";
import {
  ownerBooking,
  ownerAttempt,
  type OwnerAttempt,
} from "@root-of-cambodia/backend/bookings";
import { OwnerStayAction } from "@/features/bookings/components/owner-stay-action";
import {
  ownerStayReceipt,
  stayIntent,
} from "@root-of-cambodia/backend/bookings";
import { PaymentRecords } from "@/features/payments/components/payment-records";
import { ownerPayments } from "@root-of-cambodia/backend/payments";
import {
  paymentAttempt as readPaymentAttempt,
  type PaymentAttempt,
} from "@root-of-cambodia/backend/payments";
import { DomainError } from "@root-of-cambodia/backend/shared";
import { usd, cambodiaTime, bookingStatus } from "@/lib/booking-format";
import { BookingLogistics } from "@/features/bookings/components/booking-logistics";
import { OwnerBookingResponse } from "@/features/bookings/components/owner-booking-response";
import { PageTitle, SectionTitle } from "@/components/typography";
import { TextLink, textLinkClass } from "@/components/text-link";
import { cn } from "@/lib/utils";
export default async function Page({
  params,
  searchParams,
}: {
  params: Promise<{ id: string; bookingId: string }>;
  searchParams: Promise<{
    response?: string;
    stayAction?: string;
    stayAttempt?: string;
    paymentAttempt?: string;
    paymentCursor?: string;
  }>;
}) {
  const { id, bookingId } = await params,
    {
      response,
      stayAction,
      stayAttempt,
      paymentAttempt: paymentId,
      paymentCursor,
    } = await searchParams,
    base = `/owner/properties/${id}/bookings/${bookingId}`;
  const responseId =
    typeof response === "string" && /^[0-9a-f-]{36}$/.test(response)
      ? response
      : "";
  const intent = stayIntent(stayAction, stayAttempt);
  const stayQuery = intent
    ? `?stayAction=${intent.action}&stayAttempt=${intent.attempt}`
    : "";
  const paymentAttemptId =
    typeof paymentId === "string" && /^[0-9a-f-]{36}$/.test(paymentId)
      ? paymentId
      : "";
  const paymentQuery = paymentAttemptId
    ? "?paymentAttempt=" + paymentAttemptId
    : "";
  const { db, actor } = await ownerSession(
    base + (responseId ? "?response=" + responseId : stayQuery || paymentQuery),
  );
  let paymentReview: PaymentAttempt | null = null;
  let paymentState;
  let b,
    attempt: OwnerAttempt | null = null;
  try {
    b = await ownerRead(() => ownerBooking(db, actor, id, bookingId));
    paymentState = await ownerRead(() =>
      ownerPayments(db, actor, bookingId, paymentCursor),
    );
    if (paymentAttemptId)
      paymentReview = await ownerRead(() =>
        readPaymentAttempt(db, actor, bookingId, paymentAttemptId),
      );
    if (responseId)
      attempt = await ownerRead(() =>
        ownerAttempt(db, actor, bookingId, responseId),
      );
  } catch (error) {
    if (error instanceof DomainError && error.code === "not_found") {
      if (responseId || paymentAttemptId)
        return (
          <section className="space-y-5">
            <PageTitle>Saved review unavailable</PageTitle>
            <p>
              This response is not available to your account. If preparation was
              interrupted, reload to check again. Preparing a review never
              changes a booking.
            </p>
            <a
              className={cn(textLinkClass, "block")}
              href={
                base + (responseId ? "?response=" + responseId : paymentQuery)
              }
            >
              Check again
            </a>
            <TextLink className="block" href={base}>
              Return to current booking
            </TextLink>
          </section>
        );
      notFound();
    }
    throw error;
  }
  if (attempt?.receipt || paymentReview?.receipt) redirect(base);
  if (
    intent &&
    (await ownerRead(() => ownerStayReceipt(db, actor, bookingId, intent)))
  )
    redirect(base);
  return (
    <div className="space-y-7">
      <TextLink
        href={`/owner/properties/${id}/bookings`}>
        ← Property bookings
      </TextLink>
      <p className="font-medium text-primary">{bookingStatus(b.status)}</p>
      <PageTitle>{b.propertyName}</PageTitle>
      <p className="break-all text-xs">Booking reference: {b.id}</p>
      <section className="space-y-3 rounded-xl border p-6">
        <SectionTitle>{b.guestName}</SectionTitle>
        {b.guestEmail && <p className="break-all">{b.guestEmail}</p>}
        <p>
          {cambodiaTime(b.checkinAt)} → {cambodiaTime(b.checkoutAt)} · Cambodia
          time
        </p>
        <p className="text-2xl font-semibold">{usd(b.totalCents)}</p>
        <p>Pay at the property. No platform payment is collected.</p>
        {b.status === "pending" && (
          <p>
            Respond by {cambodiaTime(b.expiresAt)} Cambodia time. Pending
            requests hold no stock.
          </p>
        )}
      </section>
      <section className="space-y-4 rounded-xl border p-6">
        <SectionTitle>Submitted rooms and price</SectionTitle>
        {b.lines.map((l) => (
          <p key={l.id + l.night} className="text-sm">
            {l.roomName} · {l.night} · {l.quantity} units · {l.adults} adults ·{" "}
            {l.children} children · {usd(l.quantity * l.unitCents)}
          </p>
        ))}
        {b.charges.map((c, i) => (
          <p key={i}>
            {c.label}: {usd(c.amountCents)}
          </p>
        ))}
        <p className="whitespace-pre-wrap">{b.policyText}</p>
        <p>{b.cancellationText}</p>
        <p className="text-xs">{b.source === "external" ? "Recorded terms version" : "Accepted terms version"}: {b.termsVersion}</p>
      </section>
      {b.saved && (
        <BookingLogistics
          details={b.saved}
          heading="Copy saved at acceptance"
          acceptedAt={b.saved.acceptedAt}
        />
      )}
      <OwnerBookingResponse
        key={responseId || b.status}
        booking={b}
        attempt={attempt}
      />
      <OwnerStayAction
        key={intent?.attempt || b.status}
        booking={b}
        intent={intent}
      />
      <PaymentRecords
        key={paymentAttemptId || String(paymentState.revision)}
        bookingId={bookingId}
        base={base}
        state={paymentState}
        attempt={paymentReview}
      />
      <section className="space-y-3">
        <SectionTitle>Booking updates</SectionTitle>
        {b.events.map((e) => (
          <div key={e.kind} className="rounded-md bg-secondary p-4 text-sm">
            <p>
              {bookingStatus(e.kind)} · {cambodiaTime(e.occurredAt)} ·{" "}
              {e.actorRole}
            </p>
            {e.reason && <p className="mt-2 whitespace-pre-wrap">{e.reason}</p>}
          </div>
        ))}
        <a
          href={base + (responseId ? "?response=" + responseId : "")}
          className={cn(textLinkClass, "inline-block")}
        >
          Refresh booking status
        </a>
      </section>
    </div>
  );
}
