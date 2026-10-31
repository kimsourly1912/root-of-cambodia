import { notFound } from "next/navigation";
import { ownerSession, ownerRead, readTogether } from "@/server/owner-session";
import { ownerProperty } from "@root-of-cambodia/backend/properties";
import { ownerRoomType } from "@root-of-cambodia/backend/rooms";
import { DomainError } from "@root-of-cambodia/backend/shared";
import { PropertyNavigation } from "@/features/properties/components/property-navigation";
import { RoomTypeForm } from "@/features/rooms/components/room-type-form";
import { PageTitle } from "@/components/typography";
export default async function Page({
  params,
}: {
  params: Promise<{ id: string; roomId: string }>;
}) {
  const { db, actor } = await ownerSession();
  const { id, roomId } = await params;
  const data = await ownerRead(async () => {
    try {
      const [property, room] = await readTogether(
        ownerProperty(db, actor, id),
        ownerRoomType(db, actor, id, roomId),
      );
      return { property, room };
    } catch (error) {
      if (error instanceof DomainError && error.code === "not_found")
        return null;
      throw error;
    }
  });
  if (!data) notFound();
  return (
    <>
      <p lang="km" className="mb-2 break-words text-sm text-primary">
        {data.property.nameKm}
      </p>
      <PageTitle>
        Room type details
      </PageTitle>
      <p className="mt-3 text-muted-foreground">
        Review the name and guest limits for this room type.
      </p>
      <PropertyNavigation propertyId={id} active="rooms" />
      <RoomTypeForm
        key={data.room.id}
        propertyId={id}
        editable={data.property.publication === "draft"}
        room={data.room}
      />
    </>
  );
}
