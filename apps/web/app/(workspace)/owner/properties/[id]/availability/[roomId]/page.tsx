import { notFound } from "next/navigation";
import { ownerSession, ownerRead, readTogether } from "@/server/owner-session";
import { ownerProperty } from "@root-of-cambodia/backend/properties";
import { ownerRoomType } from "@root-of-cambodia/backend/rooms";
import { ownerRoomCalendar } from "@root-of-cambodia/backend/calendar";
import { cambodiaToday, shiftNight } from "@root-of-cambodia/backend/calendar";
import { DomainError } from "@root-of-cambodia/backend/shared";
import { PropertyNavigation } from "@/features/properties/components/property-navigation";
import { InventoryNightForm } from "@/features/inventory/components/inventory-night-form";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { PageTitle } from "@/components/typography";
import { TextLink } from "@/components/text-link";
export default async function Page({params, searchParams}: {
  params: Promise<{id: string; roomId: string}>;
  searchParams: Promise<{start?: string}>;
}) {
  const {id, roomId} = await params, query = await searchParams;
  const base = `/owner/properties/${id}/availability/${roomId}`;
  const {db, actor} = await ownerSession(base);
  let property, room, calendar;
  const start = query.start === undefined ? cambodiaToday() : query.start;
  try {
    [property, room, calendar] = await readTogether(
      ownerRead(() => ownerProperty(db, actor, id)),
      ownerRead(() => ownerRoomType(db, actor, id, roomId)),
      ownerRead(async () => {
        if (typeof start !== "string") throw new DomainError("invalid_dates", 422);
        return ownerRoomCalendar(db, actor, id, roomId, start);
      }),
    );
  } catch (error) {
    if (error instanceof DomainError && error.code === "not_found") notFound();
    if (error instanceof DomainError && error.code === "invalid_dates")
      return <TextLink href={base}>Invalid date. Open the current week.</TextLink>;
    throw error;
  }
  let previous: string | null = null, next: string | null = null;
  try { previous = shiftNight(start, -7); } catch {}
  try { next = shiftNight(start, 7); shiftNight(next, 6); } catch { next = null; }
  return <div className="space-y-6">
    <PageTitle>Nightly availability</PageTitle>
    <p className="break-words">{property.nameEn || property.nameKm} · {room.name}</p>
    <PropertyNavigation propertyId={id} active="availability" />
    <TextLink href={`/owner/properties/${id}/availability`}>All room types</TextLink>
    <p>Dates use Cambodia time. Save one night at a time. A new reservation may change availability while this page is open; the server checks again when you save.</p>
    <form method="get" className="flex flex-wrap items-end gap-3">
      <div className="space-y-2"><Label htmlFor="availability-start">First night</Label><Input id="availability-start" name="start" type="date" defaultValue={start} required /></div>
      <Button type="submit" variant="outline">Show week</Button>
    </form>
    <nav aria-label="Availability weeks" className="flex flex-wrap gap-5">
      {previous && <TextLink href={base + "?start=" + previous}>Previous week</TextLink>}
      {next && <TextLink href={base + "?start=" + next}>Next week</TextLink>}
    </nav>
    <div className="grid gap-5 md:grid-cols-2">{calendar.nights.map(night =>
      <InventoryNightForm key={roomId + ":" + night.night + ":" + start} roomId={roomId} night={night} returnTo={base + "?start=" + start} />
    )}</div>
    <p className="text-sm text-muted-foreground">This changes configured inventory only. Missing nights and rates must be set up in the draft calendar. It does not change prices, booking dates or reserved units.</p>
  </div>;
}
