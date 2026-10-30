import Link from "next/link";
import { notFound } from "next/navigation";
import { ownerSession, ownerRead } from "@/src/owner-session";
import { ownerProperty } from "@root-of-cambodia/backend/property-queries";
import { ownerRoomTypes } from "@root-of-cambodia/backend/room-queries";
import { externalReviews } from "@root-of-cambodia/backend/external-booking-queries";
import { DomainError } from "@root-of-cambodia/backend/errors";
import { PropertyNavigation } from "@/components/property-navigation";
import { ExternalReservationForm } from "@/components/external-reservation-form";
export default async function Page({params, searchParams}: {
  params: Promise<{id: string}>; searchParams: Promise<{cursor?: string}>;
}) {
  const {id} = await params, {cursor} = await searchParams;
  const base = `/owner/properties/${id}/bookings/external`, {db, actor} = await ownerSession(base);
  let property, rooms, reviews;
  try {
    property = await ownerRead(() => ownerProperty(db, actor, id));
    if (cursor !== undefined && typeof cursor !== "string") throw new DomainError("invalid_request", 422);
    rooms = await ownerRead(() => ownerRoomTypes(db, actor, id, cursor ?? ""));
    reviews = await ownerRead(() => externalReviews(db, actor, id));
  } catch (error) {
    if (error instanceof DomainError && error.code === "not_found") notFound();
    if (error instanceof DomainError && error.code === "invalid_request")
      return <Link href={base} className="text-primary underline">Invalid page. Open external reservations.</Link>;
    throw error;
  }
  return <div className="space-y-6">
    <h1 className="text-3xl font-semibold">Record an external reservation</h1>
    <p>{property.nameEn || property.nameKm}</p>
    <PropertyNavigation propertyId={id} active="bookings" />
    <p>Record room stock for a booking taken outside this website. Confirmation reserves every booked night immediately at the saved catalog price. Preparing a review reserves nothing.</p>
    <p className="text-sm text-muted-foreground">This record has no guest account or contact details. Negotiated prices, deposits, infant handling and physical room assignment are not supported here. It does not collect money or record a guest’s agreement to terms.</p>
    <ExternalReservationForm key={cursor ?? ""} propertyId={id} rooms={rooms.items} base={base} />
    <nav aria-label="External reservation room pages" className="flex flex-wrap gap-5">
      {cursor && <Link href={base} className="text-primary underline">First room types</Link>}
      {rooms.nextCursor && <Link href={base + "?cursor=" + encodeURIComponent(rooms.nextCursor)} className="text-primary underline">Next room types</Link>}
    </nav>
    <p className="text-sm">Choose from the room types on this page. Changing room pages discards unsaved selections. Each reservation supports up to ten selected room types.</p>
    {!!reviews.length && <section className="space-y-3"><h2 className="text-xl font-semibold">Recent saved external reviews</h2>
      {reviews.map(a => <Link key={a.id} href={base + "/" + a.id} className="block break-all text-primary underline">Open saved review {a.id.slice(0,8)}</Link>)}
    </section>}
    <Link href={`/owner/properties/${id}/bookings`} className="inline-block text-primary underline">Back to property bookings</Link>
  </div>;
}
