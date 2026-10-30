import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ownerSession, ownerRead } from "@/src/owner-session";
import {
  ownerBooking,
  ownerAttempt,
  type OwnerAttempt,
} from "@root-of-cambodia/backend/owner-bookings";
import { OwnerStayAction } from "@/components/owner-stay-action";
import {
  ownerStayReceipt,
  stayIntent,
} from "@root-of-cambodia/backend/stay-queries";
import { DomainError } from "@root-of-cambodia/backend/errors";
import { usd, cambodiaTime, bookingStatus } from "@/components/booking-format";
import { BookingLogistics } from "@/components/booking-logistics";
import { OwnerBookingResponse } from "@/components/owner-booking-response";
export default async function Page({
  params,
  searchParams,
}: {
  params: Promise<{ id: string; bookingId: string }>;
  searchParams: Promise<{
    response?: string;
    stayAction?: string;
    stayAttempt?: string;
  }>;
}) {
  const { id, bookingId } = await params,
    { response, stayAction, stayAttempt } = await searchParams,
    base = `/owner/properties/${id}/bookings/${bookingId}`;
  const responseId =
    typeof response === "string" && /^[0-9a-f-]{36}$/.test(response)
      ? response
      : "";
  const intent = stayIntent(stayAction, stayAttempt);
  const stayQuery = intent
    ? `?stayAction=${intent.action}&stayAttempt=${intent.attempt}`
    : "";
  const { db, actor } = await ownerSession(
    base + (responseId ? "?response=" + responseId : stayQuery),
  );
  let b,
    attempt: OwnerAttempt | null = null;
  try {
    b = await ownerRead(() => ownerBooking(db, actor, id, bookingId));
    if (responseId)
      attempt = await ownerRead(() =>
        ownerAttempt(db, actor, bookingId, responseId),
      );
  } catch (error) {
    if (error instanceof DomainError && error.code === "not_found") {
      if (responseId)
        return (
          <section className="space-y-5">
            <h1 className="text-2xl font-semibold">
              Saved response unavailable
            </h1>
            <p>
              This response is not available to your account. If preparation was
              interrupted, reload to check again. Preparing a review never
              changes a booking.
            </p>
            <a
              className="block text-primary underline"
              href={base + "?response=" + responseId}
            >
              Check again
            </a>
            <Link href={base} className="block text-primary underline">
              Return to current booking
            </Link>
          </section>
        );
      notFound();
    }
    throw error;
  }
  if (attempt?.receipt) redirect(base);
  if (
    intent &&
    (await ownerRead(() => ownerStayReceipt(db, actor, bookingId, intent)))
  )
    redirect(base);
  return (
    <div className="space-y-7">
      <Link
        href={`/owner/properties/${id}/bookings`}
        className="text-primary underline"
      >
        ← Property bookings
      </Link>
      <p className="font-medium text-primary">{bookingStatus(b.status)}</p>
      <h1 className="break-words text-3xl font-semibold">{b.propertyName}</h1>
      <p className="break-all text-xs">Booking reference: {b.id}</p>
      <section className="space-y-3 rounded-xl border p-6">
        <h2 className="text-xl font-semibold">{b.guestName}</h2>
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
        <h2 className="text-xl font-semibold">Submitted rooms and price</h2>
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
        <p className="text-xs">Accepted terms version: {b.termsVersion}</p>
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
      <section className="space-y-3">
        <h2 className="text-xl font-semibold">Booking updates</h2>
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
          className="inline-block text-primary underline"
        >
          Refresh booking status
        </a>
      </section>
    </div>
  );
}
