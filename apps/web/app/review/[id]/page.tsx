import { ownerSession } from "@/server/owner-session";
import { reviewerRead } from "@/features/publication/server";
import { reviewDetails } from "@root-of-cambodia/backend/publication";
import { ReviewSnapshot } from "@/features/publication/components/review-snapshot";
import { PublicationAction } from "@/features/publication/components/publication-action";
import { PublicationChecklist } from "@/features/publication/components/publication-checklist";
import { PublicStayDetails } from "@/features/catalog/components/public-stay-details";
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
        <div className="min-w-0 space-y-6">
          <PublicationChecklist readiness={data.readiness} />
          <details open className="rounded-xl border bg-card p-5">
            <summary className="mb-5 cursor-pointer text-lg font-semibold">
              Guest listing preview
            </summary>
            <PublicStayDetails
              listing={data.publicPreview.listing}
              heading="h3"
              photoBase={`/api/property-reviews/${id}/photos`}
            />
          </details>
          <details className="rounded-xl border bg-card p-5">
            <summary className="mb-5 cursor-pointer text-lg font-semibold">
              Private review context
            </summary>
            <ReviewSnapshot
              snapshot={data.request.snapshot}
              previewBase={`/api/property-reviews/${id}/photos`}
            />
          </details>
        </div>
        <aside className="lg:sticky lg:top-8">
          <Card className="shadow-none">
            <CardHeader>
              <CardTitle>
                <h2>Your decision</h2>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4 text-sm">
              <p>
                Approval makes this property eligible for guest browsing and
                booking APIs. Check its listing details and booking settings
                carefully.
              </p>
              <p>
                {data.disclosure
                  ? `Owner confirmed public display · ${data.disclosure.version}`
                  : "Owner public-display confirmation is missing. Return this earlier submission for changes."}
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
                  configRevision: data.configRevision,
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
                    disabled:
                      !data.termsVersion ||
                      !data.readiness.ready ||
                      !data.disclosure,
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
