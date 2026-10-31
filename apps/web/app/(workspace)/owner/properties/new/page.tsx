import { ownerSession, ownerRead } from "@/server/owner-session";
import { ownerProfile } from "@root-of-cambodia/backend/properties";
import { PropertyForm } from "@/features/properties/components/property-form";
import { PageTitle } from "@/components/typography";
export default async function Page() {
  const { db, actor } = await ownerSession();
  const profile = await ownerRead(() => ownerProfile(db, actor));
  return (
    <>
      <p className="mb-3 text-xs font-semibold uppercase tracking-widest text-primary">
        Property setup / 01
      </p>
      <PageTitle>
        New property draft
      </PageTitle>
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
