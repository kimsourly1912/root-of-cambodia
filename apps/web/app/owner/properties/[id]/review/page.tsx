import { notFound } from "next/navigation";
import { ownerSession, ownerRead } from "@/src/owner-session";
import { ownerPublication } from "@root-of-cambodia/backend/publication-queries";
import { DomainError } from "@root-of-cambodia/backend/errors";
import { PropertyNavigation } from "@/components/property-navigation";
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
  const data = await ownerRead(async () => {
    try {
      return await ownerPublication(db, actor, id);
    } catch (error) {
      if (error instanceof DomainError && error.code === "not_found")
        return null;
      throw error;
    }
  });
  if (!data) notFound();
  const snapshot = data.draft ?? data.latest?.snapshot;
  const pending =
    data.publication === "review" && data.latest?.status === "pending";
  return (
    <>
      <h1 className="text-3xl font-semibold tracking-tight">
        Publication review
      </h1>
      <p className="mt-3 text-muted-foreground">
        Review your saved details before sending them to the pilot reviewer.
      </p>
      <PropertyNavigation propertyId={id} active="review" />
      <div className="grid items-start gap-8 lg:grid-cols-[minmax(0,1fr)_300px]">
        {snapshot && (
          <ReviewSnapshot
            snapshot={snapshot}
            previewBase={
              pending
                ? `/api/property-reviews/${data.latest!.id}/photos`
                : data.draft
                  ? `/api/owner/properties/${id}/photos`
                  : undefined
            }
          />
        )}
        <aside className="space-y-5 lg:sticky lg:top-8">
          <Card className="shadow-none">
            <CardHeader>
              <CardTitle>
                <h2>
                  {data.publication === "published"
                    ? "Published"
                    : pending
                      ? "Awaiting review"
                      : "Prepare your submission"}
                </h2>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4 text-sm">
              <p>
                Property status:{" "}
                <strong className="capitalize">{data.publication}</strong>
              </p>
              <p>
                {pending
                  ? "Your saved details are frozen during review. Withdraw the submission if you need to edit them."
                  : data.publication === "draft"
                    ? "Save changes in each setup tab first. Submitting freezes the saved draft until you withdraw it or receive correction notes."
                    : "Your last submitted details are retained below. Public browsing is not available yet."}
              </p>
              {!data.reviewerConfigured && (
                <p>The pilot reviewer must be configured before submission.</p>
              )}
              {!data.termsConfigured && (
                <p>
                  Approved booking terms are still required before publication
                  can be approved.
                </p>
              )}
              {data.publication === "draft" && (
                <PublicationAction
                  key={`submit-${data.propertyRevision}-${data.latest?.id}`}
                  url={`/api/owner/properties/${id}/review`}
                  body={{
                    propertyRevision: data.propertyRevision,
                  }}
                  choices={[
                    {
                      action: "submit",
                      label: "Submit saved draft",
                      disabled: !data.reviewerConfigured,
                    },
                  ]}
                />
              )}
              {pending && (
                <PublicationAction
                  key={data.latest!.id}
                  url={`/api/owner/properties/${id}/review`}
                  body={{
                    requestId: data.latest!.id,
                    revision: data.latest!.revision,
                  }}
                  choices={[
                    {
                      action: "withdraw",
                      label: "Withdraw to edit",
                    },
                  ]}
                />
              )}
            </CardContent>
          </Card>
          {!!data.events.length && (
            <Card className="shadow-none">
              <CardHeader>
                <CardTitle>
                  <h2>Latest submission</h2>
                </CardTitle>
              </CardHeader>
              <CardContent>
                <ol className="space-y-4 text-sm">
                  {data.events.map((e, i) => (
                    <li key={i}>
                      <p className="font-medium">
                        {e.action.replaceAll("_", " ")} · {e.actorRole}
                      </p>
                      {e.reason && (
                        <p className="mt-1 break-words whitespace-pre-wrap">
                          {e.reason}
                        </p>
                      )}
                    </li>
                  ))}
                </ol>
              </CardContent>
            </Card>
          )}
        </aside>
      </div>
    </>
  );
}
