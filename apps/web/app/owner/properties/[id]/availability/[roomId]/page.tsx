import Link from "next/link";
import { notFound } from "next/navigation";
import { ownerSession, ownerRead } from "@/src/owner-session";
import { ownerProperty } from "@root-of-cambodia/backend/property-queries";
import { ownerRoomType } from "@root-of-cambodia/backend/room-queries";
import { ownerRoomCalendar } from "@root-of-cambodia/backend/calendar-queries";
import { cambodiaToday, shiftNight } from "@root-of-cambodia/backend/calendar-dates";
import { DomainError } from "@root-of-cambodia/backend/errors";
import { PropertyNavigation } from "@/components/property-navigation";
import { InventoryNightForm } from "@/components/inventory-night-form";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
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
    property = await ownerRead(() => ownerProperty(db, actor, id));
    room = await ownerRead(() => ownerRoomType(db, actor, id, roomId));
    if (typeof start !== "string") throw new DomainError("invalid_dates", 422);
    calendar = await ownerRead(() => ownerRoomCalendar(db, actor, id, roomId, start));
  } catch (error) {
    if (error instanceof DomainError && error.code === "not_found") notFound();
    if (error instanceof DomainError && error.code === "invalid_dates")
      return <Link href={base} className="text-primary underline">Invalid date. Open the current week.</Link>;
    throw error;
  }
  let previous: string | null = null, next: string | null = null;
  try { previous = shiftNight(start, -7); } catch {}
  try { next = shiftNight(start, 7); shiftNight(next, 6); } catch { next = null; }
  return <div className="space-y-6">
    <h1 className="text-3xl font-semibold">Nightly availability</h1>
    <p className="break-words">{property.nameEn || property.nameKm} · {room.name}</p>
    <PropertyNavigation propertyId={id} active="availability" />
    <Link href={`/owner/properties/${id}/availability`} className="text-primary underline">All room types</Link>
    <p>Dates use Cambodia time. Save one night at a time. A new reservation may change availability while this page is open; the server checks again when you save.</p>
    <form method="get" className="flex flex-wrap items-end gap-3">
      <div className="space-y-2"><Label htmlFor="availability-start">First night</Label><Input id="availability-start" name="start" type="date" defaultValue={start} required /></div>
      <Button type="submit" variant="outline">Show week</Button>
    </form>
    <nav aria-label="Availability weeks" className="flex flex-wrap gap-5">
      {previous && <Link href={base + "?start=" + previous} className="text-primary underline">Previous week</Link>}
      {next && <Link href={base + "?start=" + next} className="text-primary underline">Next week</Link>}
    </nav>
    <div className="grid gap-5 md:grid-cols-2">{calendar.nights.map(night =>
      <InventoryNightForm key={roomId + ":" + night.night + ":" + start} roomId={roomId} night={night} returnTo={base + "?start=" + start} />
    )}</div>
    <p className="text-sm text-muted-foreground">This changes configured inventory only. Missing nights and rates must be set up in the draft calendar. It does not change prices, booking dates or reserved units.</p>
  </div>;
}
