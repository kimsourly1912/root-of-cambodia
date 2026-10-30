import Link from "next/link";
import { notFound } from "next/navigation";
import { ownerSession, ownerRead } from "@/src/owner-session";
import { ownerBookings, ownerBookingStatus, ownerBookingStatuses } from "@root-of-cambodia/backend/owner-bookings";
import { ownerProperty } from "@root-of-cambodia/backend/property-queries";
import { DomainError } from "@root-of-cambodia/backend/errors";
import { PropertyNavigation } from "@/components/property-navigation";
import { usd, cambodiaTime, bookingStatus } from "@/components/booking-format";
export default async function Page({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ cursor?: string; status?: string }>;
}) {
  const { id } = await params,
    { cursor, status } = await searchParams,
    base = `/owner/properties/${id}/bookings`,
    { db, actor } = await ownerSession(base);
  let page, property, selected;
  const bookingURL = (state: string, next?: string | null) => {
    const q = new URLSearchParams();
    if (state !== "all") q.set("status", state);
    if (next) q.set("cursor", next);
    return base + (q.size ? "?" + q.toString() : "");
  };
  try {
    property = await ownerRead(() => ownerProperty(db, actor, id));
    selected = ownerBookingStatus(status);
    page = await ownerRead(() => ownerBookings(db, actor, id, cursor, selected));
  } catch (error) {
    if (error instanceof DomainError && error.code === "not_found") notFound();
    if (error instanceof DomainError && error.code === "invalid_request")
      return (
        <Link href={base} className="text-primary underline">
          Invalid filter or page. Open current bookings.
        </Link>
      );
    throw error;
  }
  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-semibold">Property bookings</h1>
      <p>{property.nameEn || property.nameKm}</p>
      <PropertyNavigation propertyId={id} active="bookings" />
      <Link href={base + "/external"} className="inline-block text-primary underline">Record an external reservation</Link>
      <p className="text-sm text-muted-foreground">
        Pending requests hold no rooms. Acceptance checks stock for every night.
        Existing bookings remain available when a listing is paused.
      </p>
      <nav aria-label="Booking status" className="flex flex-wrap gap-2">
        {(["all", ...ownerBookingStatuses] as const).map(state => (
          <Link key={state} href={bookingURL(state)} aria-current={selected === state ? "page" : undefined}
            className={selected === state ? "rounded-full bg-primary px-4 py-2 text-sm text-primary-foreground" : "rounded-full border px-4 py-2 text-sm text-primary"}>
            {state === "all" ? "All bookings" : bookingStatus(state)}
          </Link>
        ))}
      </nav>
      <p className="text-sm text-muted-foreground">
        Showing {selected === "all" ? "all bookings" : bookingStatus(selected).toLowerCase()} · newest requests first.
        Filters show saved status; response deadlines are checked again when you act.
      </p>
      {page.items.length ? (
        <ul className="grid gap-5 md:grid-cols-2">
          {page.items.map((b) => (
            <li key={b.id} className="min-w-0 space-y-3 rounded-xl border p-5">
              <span className="rounded-full bg-secondary px-3 py-1 text-xs font-medium">
                {bookingStatus(b.status)}
              </span>
              <h2 className="break-words font-semibold">{b.guestName}</h2>
              <p>
                {b.checkinDate} → {b.checkoutDate}
              </p>
              <p>{usd(b.totalCents)}</p>
              {b.status === "pending" && (
                <p className="text-sm">
                  Respond by {cambodiaTime(b.expiresAt)} Cambodia time
                </p>
              )}
              <Link
                href={base + "/" + b.id}
                className="inline-block text-primary underline"
              >
                View request
              </Link>
            </li>
          ))}
        </ul>
      ) : (
        <p className="rounded-xl border p-8">No {selected === "all" ? "bookings" : bookingStatus(selected).toLowerCase() + " bookings"} on this page.</p>
      )}
      <nav className="flex gap-5" aria-label="Property booking pages">
        {cursor && (
          <Link className="text-primary underline" href={bookingURL(selected)}>
            Newest bookings
          </Link>
        )}
        {page.nextCursor && (
          <Link
            className="text-primary underline"
            href={bookingURL(selected, page.nextCursor)}
          >
            Older bookings
          </Link>
        )}
      </nav>
    </div>
  );
}
