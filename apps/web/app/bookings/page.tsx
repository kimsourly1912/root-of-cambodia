import Link from "next/link";
import { guestSession } from "@/src/guest-session";
import { ownerRead } from "@/src/owner-session";
import { guestBookings } from "@root-of-cambodia/backend/bookings";
import { DomainError } from "@root-of-cambodia/backend/shared";
import { usd, bookingStatus } from "@/components/booking-format";
export default async function Page({
  searchParams,
}: {
  searchParams: Promise<{ cursor?: string }>;
}) {
  const { cursor } = await searchParams,
    { db, actor } = await guestSession("/bookings");
  let page;
  try {
    page = await ownerRead(() => guestBookings(db, actor, cursor));
  } catch (error) {
    if (error instanceof DomainError && error.code === "invalid_request")
      return (
        <p>
          Invalid page.{" "}
          <Link href="/bookings" className="underline">
            Open My bookings
          </Link>
        </p>
      );
    throw error;
  }
  return (
    <div className="space-y-7">
      <h1 className="text-3xl font-semibold">My bookings</h1>
      <p className="text-muted-foreground">
        Track your requests and confirmed stays. Payment is made directly to the
        property.
      </p>
      {!!page.drafts.length && (
        <section className="space-y-3 rounded-lg border p-5">
          <h2 className="font-semibold">Saved request reviews</h2>
          <p className="text-sm">
            These reviews have not produced a confirmed submission. Open one to
            send or recover the same request.
          </p>
          {page.drafts.map((d) => (
            <Link
              className="block text-primary underline"
              key={d.id}
              href={`/bookings/requests/${d.id}`}
            >
              {d.propertyName} · Open saved review
            </Link>
          ))}
        </section>
      )}
      {page.items.length ? (
        <ul className="grid gap-5 md:grid-cols-2">
          {page.items.map((b) => (
            <li
              key={b.id}
              className="min-w-0 space-y-3 rounded-xl border bg-card p-5"
            >
              <span className="inline-block rounded-full bg-secondary px-3 py-1 text-xs font-medium">
                {bookingStatus(b.status)}
              </span>
              <h2 className="break-words text-lg font-semibold">
                {b.propertyName}
              </h2>
              <p>
                {b.checkinDate} → {b.checkoutDate}
              </p>
              <p>{usd(b.totalCents)}</p>
              <Link
                className="inline-block text-primary underline"
                href={`/bookings/${b.id}`}
              >
                View booking
              </Link>
            </li>
          ))}
        </ul>
      ) : (
        <section className="space-y-4 rounded-xl border p-8">
          <h2 className="text-xl font-semibold">No bookings on this page</h2>
          <Link href="/stays" className="text-primary underline">
            Explore stays
          </Link>
        </section>
      )}
      <nav aria-label="Booking pages" className="flex gap-6">
        {cursor && (
          <Link href="/bookings" className="text-primary underline">
            Newest bookings
          </Link>
        )}
        {page.nextCursor && (
          <Link
            href={`/bookings?cursor=${encodeURIComponent(page.nextCursor)}`}
            className="text-primary underline"
          >
            Older bookings
          </Link>
        )}
      </nav>
    </div>
  );
}
