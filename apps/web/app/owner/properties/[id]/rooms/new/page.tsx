import { notFound } from "next/navigation";
import { ownerSession, ownerRead } from "@/src/owner-session";
import { ownerProperty } from "@root-of-cambodia/backend/properties";
import { DomainError } from "@root-of-cambodia/backend/shared";
import { PropertyNavigation } from "@/components/property-navigation";
import { RoomTypeForm } from "@/components/room-type-form";
export default async function Page({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { db, actor } = await ownerSession();
  const { id } = await params;
  const property = await ownerRead(async () => {
    try {
      return await ownerProperty(db, actor, id);
    } catch (error) {
      if (error instanceof DomainError && error.code === "not_found")
        return null;
      throw error;
    }
  });
  if (!property) notFound();
  return (
    <>
      <p lang="km" className="mb-2 break-words text-sm text-primary">
        {property.nameKm}
      </p>
      <h1 className="text-3xl font-semibold tracking-tight">New room type</h1>
      <p className="mt-3 text-muted-foreground">
        Enter a name and the guest limits for one unit.
      </p>
      <PropertyNavigation propertyId={id} active="rooms" />
      <RoomTypeForm
        propertyId={id}
        editable={property.publication === "draft"}
      />
    </>
  );
}
