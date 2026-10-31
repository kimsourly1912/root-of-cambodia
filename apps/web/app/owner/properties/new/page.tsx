import { ownerSession, ownerRead } from "@/src/owner-session";
import { ownerProfile } from "@root-of-cambodia/backend/properties";
import { PropertyForm } from "@/components/property-form";
export default async function Page() {
  const { db, actor } = await ownerSession();
  const profile = await ownerRead(() => ownerProfile(db, actor));
  return (
    <>
      <p className="mb-3 text-xs font-semibold uppercase tracking-widest text-primary">
        Property setup / 01
      </p>
      <h1 className="text-3xl font-semibold tracking-tight">
        New property draft
      </h1>
      <p className="mb-8 mt-3 text-muted-foreground">
        Start with the essentials. All fields are required unless marked
        optional.
      </p>
      <PropertyForm
        ownerName={profile.displayName}
        profileExists={profile.exists}
      />
    </>
  );
}
