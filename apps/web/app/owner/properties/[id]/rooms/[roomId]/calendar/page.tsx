import { notFound } from "next/navigation";
import { ownerSession, ownerRead } from "@/server/owner-session";
import { ownerProperty } from "@root-of-cambodia/backend/properties";
import { ownerRoomType } from "@root-of-cambodia/backend/rooms";
import { ownerRoomCalendar } from "@root-of-cambodia/backend/calendar";
import {
  cambodiaToday,
  shiftNight,
} from "@root-of-cambodia/backend/calendar";
import { DomainError } from "@root-of-cambodia/backend/shared";
import { PropertyNavigation } from "@/features/properties/components/property-navigation";
import { RoomCalendarForm } from "@/features/calendar/components/room-calendar-form";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { PageTitle } from "@/components/typography";
import { TextLink } from "@/components/text-link";
export default async function Page({
  params,
  searchParams,
}: {
  params: Promise<{ id: string; roomId: string }>;
  searchParams: Promise<{ start?: string }>;
}) {
  const { db, actor } = await ownerSession();
  const { id, roomId } = await params;
  const query = await searchParams;
  const start = typeof query.start === "string" ? query.start : cambodiaToday();
  const data = await ownerRead(async () => {
    try {
      return {
        property: await ownerProperty(db, actor, id),
        room: await ownerRoomType(db, actor, id, roomId),
        calendar: await ownerRoomCalendar(db, actor, id, roomId, start),
      };
    } catch (error) {
      if (
        error instanceof DomainError &&
        (error.code === "not_found" || error.code === "invalid_dates")
      )
        return null;
      throw error;
    }
  });
  if (!data) notFound();
  const base = `/owner/properties/${id}/rooms/${roomId}`;
  let previous: string | null = null,
    next: string | null = null;
  try {
    previous = shiftNight(start, -7);
  } catch {}
  try {
    next = shiftNight(start, 7);
    shiftNight(next, 6);
  } catch {
    next = null;
  }
  return (
    <>
      <p className="mb-2 break-words text-sm text-primary">
        {data.property.nameKm} · {data.room.name}
      </p>
      <PageTitle>
        Prices and availability
      </PageTitle>
      <p className="mt-3 text-muted-foreground">
        Set prices and unit counts for each night. Dates use Cambodia time.
      </p>
      <PropertyNavigation propertyId={id} active="rooms" />
      <TextLink className="mb-6 inline-block text-sm"
        href={base}>
        ← Room type details
      </TextLink>
      <div className="mb-6 flex flex-wrap items-end justify-between gap-5">
        <form method="get" className="flex flex-wrap items-end gap-3">
          <div className="space-y-2">
            <Label htmlFor="start">First night</Label>
            <Input
              id="start"
              name="start"
              type="date"
              defaultValue={start}
              required
            />
          </div>
          <Button variant="outline" type="submit">
            Show week
          </Button>
        </form>
        <nav
          aria-label="Calendar weeks"
          className="flex gap-5 text-sm text-primary"
        >
          {previous && (
            <TextLink
              href={base + "/calendar?start=" + previous}>
              ← Previous week
            </TextLink>
          )}
          {next && (
            <TextLink
              href={base + "/calendar?start=" + next}>
              Next week →
            </TextLink>
          )}
        </nav>
      </div>
      <RoomCalendarForm
        key={roomId + ":" + start}
        propertyId={id}
        roomId={roomId}
        editable={data.property.publication === "draft"}
        roomRevision={data.calendar.roomRevision}
        nights={data.calendar.nights}
      />
      <p className="mt-6 text-xs text-muted-foreground">
        Change weeks after saving your edits. Configuring this calendar does not
        publish your property.
      </p>
    </>
  );
}
