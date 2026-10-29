import { notFound } from "next/navigation";
import { ownerSession, ownerRead } from "@/src/owner-session";
import { ownerProperty } from "@root-of-cambodia/backend/property-queries";
import { ownerPropertyInformation } from "@root-of-cambodia/backend/property-information-queries";
import { DomainError } from "@root-of-cambodia/backend/errors";
import { PropertyNavigation } from "@/components/property-navigation";
import { PropertyInformationForm } from "@/components/property-information-form";
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
        information: await ownerPropertyInformation(db, actor, id),
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
      <h1 className="text-3xl font-semibold tracking-tight">
        Property information
      </h1>
      <p className="mt-3 text-muted-foreground">
        Add a description, address and facilities to your private draft.
      </p>
      <PropertyNavigation propertyId={id} active="information" />
      <PropertyInformationForm
        key={id}
        propertyId={id}
        information={data.information}
        editable={data.property.publication === "draft"}
      />
    </>
  );
}
