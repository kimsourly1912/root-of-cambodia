import { notFound } from "next/navigation";
import { ownerSession, ownerRead } from "@/server/owner-session";
import { ownerMediaGallery } from "@root-of-cambodia/backend/media";
import { DomainError } from "@root-of-cambodia/backend/shared";
import { PropertyNavigation } from "@/features/properties/components/property-navigation";
import { PropertyPhotos } from "@/features/media/components/property-photos";
import { PageTitle } from "@/components/typography";
export default async function Page({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { db, actor } = await ownerSession(),
    { id } = await params;
  const gallery = await ownerRead(async () => {
    try {
      return await ownerMediaGallery(db, actor, id);
    } catch (error) {
      if (error instanceof DomainError && error.code === "not_found")
        return null;
      throw error;
    }
  });
  if (!gallery) notFound();
  return (
    <>
      <p className="mb-2 text-sm text-primary">Private property draft</p>
      <PageTitle>Property photos</PageTitle>
      <p className="mt-3 text-muted-foreground">
        Add and arrange photos while preparing your property.
      </p>
      <PropertyNavigation propertyId={id} active="photos" />
      <PropertyPhotos propertyId={id} initial={gallery} />
    </>
  );
}
