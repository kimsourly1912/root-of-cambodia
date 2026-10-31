import { notFound } from "next/navigation";
import { ownerSession, ownerRead } from "@/server/owner-session";
import { ownerProperty } from "@root-of-cambodia/backend/properties";
import { ownerRoomTypes } from "@root-of-cambodia/backend/rooms";
import { externalReviews } from "@root-of-cambodia/backend/external-bookings";
import { DomainError } from "@root-of-cambodia/backend/shared";
import { PropertyNavigation } from "@/features/properties/components/property-navigation";
import { ExternalReservationForm } from "@/features/external-bookings/components/external-reservation-form";
import { PageTitle, SectionTitle } from "@/components/typography";
import { TextLink } from "@/components/text-link";
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
      return <TextLink href={base}>Invalid page. Open external reservations.</TextLink>;
    throw error;
  }
  return <div className="space-y-6">
    <PageTitle>Record an external reservation</PageTitle>
    <p>{property.nameEn || property.nameKm}</p>
    <PropertyNavigation propertyId={id} active="bookings" />
    <p>Record room stock for a booking taken outside this website. Confirmation reserves every booked night immediately at the saved catalog price. Preparing a review reserves nothing.</p>
    <p className="text-sm text-muted-foreground">This record has no guest account or contact details. Negotiated prices, deposits, infant handling and physical room assignment are not supported here. It does not collect money or record a guest’s agreement to terms.</p>
    <ExternalReservationForm key={cursor ?? ""} propertyId={id} rooms={rooms.items} base={base} />
    <nav aria-label="External reservation room pages" className="flex flex-wrap gap-5">
      {cursor && <TextLink href={base}>First room types</TextLink>}
      {rooms.nextCursor && <TextLink href={base + "?cursor=" + encodeURIComponent(rooms.nextCursor)}>Next room types</TextLink>}
    </nav>
    <p className="text-sm">Choose from the room types on this page. Changing room pages discards unsaved selections. Each reservation supports up to ten selected room types.</p>
    {!!reviews.length && <section className="space-y-3"><SectionTitle>Recent saved external reviews</SectionTitle>
      {reviews.map(a => <TextLink className="block" key={a.id} href={base + "/" + a.id}>Open saved review {a.id.slice(0,8)}</TextLink>)}
    </section>}
    <TextLink className="inline-block" href={`/owner/properties/${id}/bookings`}>Back to property bookings</TextLink>
  </div>;
}
