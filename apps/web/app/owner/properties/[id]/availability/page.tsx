import { notFound } from "next/navigation";
import { ownerSession, ownerRead } from "@/server/owner-session";
import { ownerProperty } from "@root-of-cambodia/backend/properties";
import { ownerRoomTypes } from "@root-of-cambodia/backend/rooms";
import { DomainError } from "@root-of-cambodia/backend/shared";
import { PropertyNavigation } from "@/features/properties/components/property-navigation";
import { PageTitle, SectionTitle } from "@/components/typography";
import { TextLink } from "@/components/text-link";
export default async function Page({params, searchParams}: {
  params: Promise<{id: string}>;
  searchParams: Promise<{cursor?: string}>;
}) {
  const {id} = await params, {cursor} = await searchParams;
  const base = `/owner/properties/${id}/availability`;
  const {db, actor} = await ownerSession(base);
  let property, rooms;
  try {
    property = await ownerRead(() => ownerProperty(db, actor, id));
    if (cursor !== undefined && typeof cursor !== "string") throw new DomainError("invalid_request", 422);
    rooms = await ownerRead(() => ownerRoomTypes(db, actor, id, cursor ?? ""));
  } catch (error) {
    if (error instanceof DomainError && error.code === "not_found") notFound();
    if (error instanceof DomainError && error.code === "invalid_request")
      return <TextLink href={base}>Invalid page. Open availability.</TextLink>;
    throw error;
  }
  return <div className="space-y-6">
    <PageTitle>Manage availability</PageTitle>
    <p>{property.nameEn || property.nameKm}</p>
    <PropertyNavigation propertyId={id} active="availability" />
    <p>Adjust configured nightly unit counts or block units for repairs and personal use. Existing reservations stay protected. Prices and listing content are unchanged.</p>
    {rooms.items.length ? <ul className="grid gap-4 sm:grid-cols-2">{rooms.items.map(room =>
      <li key={room.id} className="min-w-0 space-y-3 rounded-xl border p-5">
        <SectionTitle size="sm">{room.name}</SectionTitle>
        {!room.active && <p className="text-sm">Inactive room type</p>}
        <TextLink className="inline-block" href={base + "/" + room.id}>Manage nights</TextLink>
      </li>)}</ul> : <p>No room types on this page. Create room types and configure nights while the property is a draft.</p>}
    <nav aria-label="Availability room pages" className="flex flex-wrap gap-5">
      {cursor && <TextLink href={base}>First page</TextLink>}
      {rooms.nextCursor && <TextLink href={base + "?cursor=" + encodeURIComponent(rooms.nextCursor)}>Next room types</TextLink>}
    </nav>
  </div>;
}
