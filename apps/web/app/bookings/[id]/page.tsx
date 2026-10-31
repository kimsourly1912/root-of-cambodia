import { notFound } from "next/navigation";
import { guestSession } from "@/server/guest-session";
import { ownerRead } from "@/server/owner-session";
import { guestBooking } from "@root-of-cambodia/backend/bookings";
import { DomainError } from "@root-of-cambodia/backend/shared";
import { usd, cambodiaTime, bookingStatus } from "@/lib/booking-format";
import { BookingLogistics } from "@/features/bookings/components/booking-logistics";
import { GuestPaymentRecord } from "@/features/payments/components/payment-records";
import { GuestCancel } from "@/features/bookings/components/guest-cancel";
import { PageTitle, SectionTitle } from "@/components/typography";
import { TextLink, textLinkClass } from "@/components/text-link";
import { StatusMessage } from "@/components/status-message";
import { cn } from "@/lib/utils";
export default async function Page({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ cancelAttempt?: string }>;
}) {
  const { id } = await params,
    raw = await searchParams;
  const cancelAttempt =
    typeof raw.cancelAttempt === "string" &&
    /^[0-9a-f-]{36}$/.test(raw.cancelAttempt)
      ? raw.cancelAttempt
      : "";
  const { db, actor } = await guestSession(
    `/bookings/${id}${cancelAttempt ? "?cancelAttempt=" + cancelAttempt : ""}`,
  );
  let b;
  try {
    b = await ownerRead(() => guestBooking(db, actor, id));
  } catch (error) {
    if (error instanceof DomainError && error.code === "not_found") notFound();
    throw error;
  }
  return (
    <div className="space-y-7">
      <TextLink href="/bookings">
        ← My bookings
      </TextLink>
      <div className="space-y-3">
        <p className="font-medium text-primary">{bookingStatus(b.status)}</p>
        <PageTitle>{b.propertyName}</PageTitle>
        <p className="break-all text-xs text-muted-foreground">
          Booking reference: {b.id}
        </p>
      </div>
      <section className="space-y-4 rounded-xl border bg-card p-6">
        <p>Check-in: {cambodiaTime(b.checkinAt)}</p>
        <p>Check-out: {cambodiaTime(b.checkoutAt)} · Cambodia time</p>
        <p className="text-2xl font-semibold">{usd(b.totalCents)}</p>
        <p>$0 collected by this platform · Pay at the property</p>
        {b.status === "pending" && (
          <>
            <p>
              The owner must respond by {cambodiaTime(b.expiresAt)} Cambodia
              time. Your room is not held until confirmation.
            </p>
            {b.expiresAt <= Date.now() / 1000 && (
              <StatusMessage tone="info">
                The response deadline has passed. Owner acceptance is no longer
                allowed; the expiry record may still be updating.
              </StatusMessage>
            )}
          </>
        )}
        <GuestPaymentRecord payment={b.payment} />
        {b.status === "confirmed" && <p>Your stay is confirmed.</p>}
        {["declined", "expired", "cancelled"].includes(b.status) && (
          <TextLink className="block" href="/stays">
            Explore stays for a new request
          </TextLink>
        )}
      </section>
      {b.status === "confirmed" &&
        (b.logistics ? (
          <BookingLogistics
            details={b.logistics}
            heading="Your address, contact and arrival details"
            acceptedAt={b.logistics.acceptedAt}
          />
        ) : (
          <p>
            Saved address, contact and arrival details are unavailable for this
            earlier booking. Current property details have not been substituted.
          </p>
        ))}
      <section className="space-y-4 rounded-xl border p-6">
        <SectionTitle>Rooms and price</SectionTitle>
        <ul className="space-y-3">
          {b.lines.map((l) => (
            <li
              key={l.id + l.night}
              className="flex flex-wrap justify-between gap-3 text-sm"
            >
              <span>
                {l.roomName} · {l.night}
                <br />
                {l.quantity} units · {l.adults} adults · {l.children} children
              </span>
              <span>
                {l.quantity} × {usd(l.unitCents)} ={" "}
                {usd(l.quantity * l.unitCents)}
              </span>
            </li>
          ))}
        </ul>
        {b.charges.map((c, i) => (
          <p key={i} className="text-sm">
            {c.label}: {usd(c.amountCents)}
          </p>
        ))}
        <p className="whitespace-pre-wrap">{b.policyText}</p>
        <p>{b.cancellationText}</p>
        <p className="text-xs text-muted-foreground">
          Accepted booking terms version: {b.termsVersion}
        </p>
      </section>
      <section className="space-y-4">
        <SectionTitle>Booking updates</SectionTitle>
        <ol className="space-y-3">
          {b.events.map((e) => (
            <li key={e.kind} className="rounded-lg bg-secondary p-4 text-sm">
              <p>
                {bookingStatus(e.kind)} · {cambodiaTime(e.occurredAt)} ·{" "}
                {e.actorRole}
              </p>
              {e.reason && (
                <p className="mt-2 whitespace-pre-wrap">{e.reason}</p>
              )}
            </li>
          ))}
        </ol>
        <a
          href={`/bookings/${id}${cancelAttempt ? "?cancelAttempt=" + cancelAttempt : ""}`}
          className={cn(textLinkClass, "inline-block")}
        >
          Refresh booking status
        </a>
      </section>
      {["pending", "confirmed"].includes(b.status) && (
        <section className="rounded-xl border p-6">
          <GuestCancel
            id={id}
            checkinAt={b.checkinAt}
            attempt={cancelAttempt}
          />
        </section>
      )}
    </div>
  );
}
