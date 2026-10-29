import { ownerSession } from "@/src/owner-session";
import { reviewerRead } from "@/src/reviewer-read";
import { reviewDetails } from "@root-of-cambodia/backend/publication-queries";
import { ReviewSnapshot } from "@/components/review-snapshot";
import { PublicationAction } from "@/components/publication-action";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
export default async function Page({
  params,
}: {
  params: Promise<{
    id: string;
  }>;
}) {
  const { db, actor } = await ownerSession(),
    { id } = await params;
  const data = await reviewerRead(() => reviewDetails(db, actor, id));
  return (
    <>
      <h1 className="text-3xl font-semibold tracking-tight">
        Review submission
      </h1>
      <p className="mb-8 mt-3 text-muted-foreground">
        Assess the saved submission and send clear correction notes if changes
        are needed.
      </p>
      <div className="grid items-start gap-8 lg:grid-cols-[minmax(0,1fr)_300px]">
        <ReviewSnapshot
          snapshot={data.request.snapshot}
          previewBase={`/api/property-reviews/${id}/photos`}
        />
        <aside className="lg:sticky lg:top-8">
          <Card className="shadow-none">
            <CardHeader>
              <CardTitle>Your decision</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4 text-sm">
              <p>
                Approval makes this property eligible for booking APIs. Check
                its listing details and booking settings carefully.
              </p>
              <p>
                {data.termsVersion
                  ? `Approved booking terms: ${data.termsVersion}`
                  : "Publication is blocked until approved booking terms are configured."}
              </p>
              <PublicationAction
                key={`${id}-${data.request.revision}`}
                url={`/api/property-reviews/${id}`}
                body={{
                  revision: data.request.revision,
                }}
                reviewer
                choices={[
                  {
                    action: "return_changes",
                    label: "Return for changes",
                  },
                  {
                    action: "approve",
                    label: "Approve and publish",
                    disabled: !data.termsVersion,
                  },
                ]}
              />
            </CardContent>
          </Card>
        </aside>
      </div>
    </>
  );
}
