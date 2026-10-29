import { notFound } from "next/navigation";
import { ownerSession, ownerRead } from "@/src/owner-session";
import { ownerProperty } from "@root-of-cambodia/backend/property-queries";
import { DomainError } from "@root-of-cambodia/backend/errors";
import { PropertyForm } from "@/components/property-form";
export default async function Page({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { db, actor } = await ownerSession();
  const { id } = await params;
  let property;
  try {
    property = await ownerRead(() => ownerProperty(db, actor, id));
  } catch (error) {
    if (error instanceof DomainError && error.code === "not_found") notFound();
    throw error;
  }
  return (
    <>
      <p className="mb-3 text-xs font-semibold uppercase tracking-widest text-primary">
        Property setup / 01
      </p>
      <h1 className="text-3xl font-semibold tracking-tight">
        Property details
      </h1>
      <p className="mb-8 mt-3 text-muted-foreground">
        Review and update your saved details.
      </p>
      <PropertyForm key={property.id} property={property} />
    </>
  );
}
