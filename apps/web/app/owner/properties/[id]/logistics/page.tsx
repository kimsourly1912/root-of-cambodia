import { notFound } from "next/navigation";
import { ownerSession, ownerRead } from "@/server/owner-session";
import { ownerProperty } from "@root-of-cambodia/backend/properties";
import { ownerPropertyLogistics } from "@root-of-cambodia/backend/property-logistics";
import { DomainError } from "@root-of-cambodia/backend/shared";
import { PropertyNavigation } from "@/features/properties/components/property-navigation";
import { PropertyLogisticsForm } from "@/features/property-logistics/components/property-logistics-form";
import { PageTitle } from "@/components/typography";
export default async function Page({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { db, actor } = await ownerSession();
  const { id } = await params;
  const data = await ownerRead(async () => {
    try {
      return {
        property: await ownerProperty(db, actor, id),
        logistics: await ownerPropertyLogistics(db, actor, id),
      };
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
        Location &amp; contact
      </PageTitle>
      <p className="mt-3 text-muted-foreground">
        Save your location, contact details and arrival instructions privately.
      </p>
      <PropertyNavigation propertyId={id} active="logistics" />
      {data.property.publication==="draft"&&<p role="note" className="my-5 rounded-lg border p-4 text-sm">
        Changes here do not update contact or arrival details already saved for confirmed bookings, and do not notify those guests.
      </p>}
      <PropertyLogisticsForm
        key={id}
        propertyId={id}
        logistics={data.logistics}
        editable={data.property.publication === "draft"}
      />
    </>
  );
}
