import Link from "next/link";
import { ownerSession, ownerRead } from "@/server/owner-session";
import { ownerAccessStatus } from "@root-of-cambodia/backend/owner-access";
import { OwnerApplicationForm } from "@/features/owner-access/components/owner-application-form";
import { PageTitle, SectionTitle } from "@/components/typography";
import { StatusMessage } from "@/components/status-message";
import { buttonVariants } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { cambodiaTime } from "@/lib/booking-format";

export const metadata = { title: "List your property" };

export default async function Page() {
  const { db, actor } = await ownerSession("/owner/apply");
  const access = await ownerRead(() => ownerAccessStatus(db, actor));
  const application = access.application;
  return (
    <div className="space-y-6">
      <div>
        <PageTitle>List your property</PageTitle>
        <p className="mt-3 max-w-2xl text-muted-foreground">
          During the pilot, the platform team approves each new owner before they can create
          property drafts. Every listing is still reviewed before guests can see it.
        </p>
      </div>
      {access.status === "approved" ? (
        <Card>
          <CardContent className="space-y-4 p-6">
            <StatusMessage tone="success">Your owner access is approved.</StatusMessage>
            <Link href="/owner" className={buttonVariants()}>Go to your properties</Link>
          </CardContent>
        </Card>
      ) : access.status === "pending" && application ? (
        <Card>
          <CardContent className="space-y-3 p-6">
            <SectionTitle as="h2">Application received</SectionTitle>
            <StatusMessage tone="info">
              Waiting for the platform team. You can return to this page to check the status.
            </StatusMessage>
            <dl className="grid gap-2 text-sm sm:grid-cols-[12rem_1fr]">
              <dt className="text-muted-foreground">Business or owner name</dt>
              <dd className="break-words">{application.businessName}</dd>
              <dt className="text-muted-foreground">Phone number</dt>
              <dd>{application.phone}</dd>
              <dt className="text-muted-foreground">Province</dt>
              <dd>{application.province}</dd>
              <dt className="text-muted-foreground">Sent</dt>
              <dd>{cambodiaTime(application.submittedAt)}</dd>
            </dl>
          </CardContent>
        </Card>
      ) : (
        <section className="space-y-4">
          {access.status === "declined" && (
            <StatusMessage tone="error">
              Your last application was declined{access.declineReason ? `: ${access.declineReason}` : "."} You can
              update your details and apply again.
            </StatusMessage>
          )}
          <SectionTitle as="h2">Owner application</SectionTitle>
          <OwnerApplicationForm
            initial={{
              businessName: application?.businessName ?? "",
              phone: application?.phone ?? "",
              province: application?.province ?? "",
            }}
          />
        </section>
      )}
    </div>
  );
}
