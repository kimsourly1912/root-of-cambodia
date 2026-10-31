import { ownerSession, readOrNotFound } from "@/server/owner-session";
import { ownerApplications } from "@root-of-cambodia/backend/owner-access";
import { OwnerApplicationDecision } from "@/features/owner-access/components/owner-application-decision";
import { PageTitle, SectionTitle } from "@/components/typography";
import { EmptyState } from "@/components/empty-state";
import { TextLink } from "@/components/text-link";
import { Card, CardContent } from "@/components/ui/card";
import { cambodiaTime } from "@/lib/booking-format";

export const metadata = { title: "Owner applications" };

export default async function Page({ searchParams }: { searchParams: Promise<{ cursor?: string }> }) {
  const { db, actor } = await ownerSession("/admin/owners");
  const { cursor } = await searchParams;
  const result = await readOrNotFound(() =>
    ownerApplications(db, actor, typeof cursor === "string" ? cursor : ""),
  );
  return (
    <div className="space-y-6">
      <div>
        <PageTitle>Owner applications</PageTitle>
        <p className="mt-3 max-w-2xl text-muted-foreground">
          Pending applications, oldest first. Approving gives the account owner access so it can
          create property drafts; every listing is still reviewed before publication.
        </p>
      </div>
      {result.items.length ? (
        <ul className="grid gap-4 lg:grid-cols-2">
          {result.items.map((item) => (
            <li key={item.userId}>
              <Card>
                <CardContent className="space-y-4 p-6">
                  <SectionTitle as="h2" size="sm">{item.businessName}</SectionTitle>
                  <dl className="grid gap-2 text-sm sm:grid-cols-[9rem_1fr]">
                    <dt className="text-muted-foreground">Account</dt>
                    <dd className="break-words">{item.accountName} · {item.accountEmail}</dd>
                    <dt className="text-muted-foreground">Phone number</dt>
                    <dd>{item.phone}</dd>
                    <dt className="text-muted-foreground">Province</dt>
                    <dd>{item.province}</dd>
                    <dt className="text-muted-foreground">Sent</dt>
                    <dd>{cambodiaTime(item.submittedAt)}</dd>
                  </dl>
                  <OwnerApplicationDecision userId={item.userId} revision={item.revision} applicant={item.businessName} />
                </CardContent>
              </Card>
            </li>
          ))}
        </ul>
      ) : (
        <EmptyState
          title={cursor ? "No more applications" : "No pending applications"}
          description={cursor ? "Return to the first page to see the oldest applications." : "New owner applications appear here."}
        >
          {cursor && <TextLink href="/admin/owners">First page</TextLink>}
        </EmptyState>
      )}
      {result.nextCursor && (
        <TextLink className="text-sm" href={"/admin/owners?cursor=" + encodeURIComponent(result.nextCursor)}>
          Next page →
        </TextLink>
      )}
    </div>
  );
}
