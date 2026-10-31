import Link from "next/link";
import { ownerSession, ownerRead, readTogether } from "@/server/owner-session";
import { capabilities } from "@root-of-cambodia/backend/shared";
import { StatusMessage } from "@/components/status-message";
import { buttonVariants } from "@/components/ui/button";
import { ownerProfile } from "@root-of-cambodia/backend/properties";
import { PropertyForm } from "@/features/properties/components/property-form";
import { PageTitle } from "@/components/typography";
export default async function Page() {
  const { db, actor } = await ownerSession("/owner/properties/new");
  const [profile, access] = await readTogether(
    ownerRead(() => ownerProfile(db, actor)),
    ownerRead(() => capabilities(db, actor)),
  );
  if (!access.owner)
    return (
      <div className="space-y-4">
        <PageTitle>New property draft</PageTitle>
        <StatusMessage tone="info">
          Creating a property draft needs approved owner access.
        </StatusMessage>
        <Link href="/owner/apply" className={buttonVariants()}>
          List your property
        </Link>
      </div>
    );
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
