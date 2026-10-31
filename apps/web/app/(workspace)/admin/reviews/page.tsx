import { ownerSession } from "@/server/owner-session";
import { reviewerRead } from "@/features/publication/server";
import { reviewQueue } from "@root-of-cambodia/backend/publication";
import { Card, CardContent } from "@/components/ui/card";
import { PageTitle, SectionTitle } from "@/components/typography";
import { TextLink } from "@/components/text-link";
export default async function Page({
  searchParams,
}: {
  searchParams: Promise<{
    cursor?: string;
  }>;
}) {
  const { db, actor } = await ownerSession(),
    { cursor } = await searchParams;
  const result = await reviewerRead(() =>
    reviewQueue(db, actor, typeof cursor === "string" ? cursor : ""),
  );
  return (
    <>
      <PageTitle>
        Publication reviews
      </PageTitle>
      <p className="mb-8 mt-3 text-muted-foreground">
        Pending property submissions, oldest first.
      </p>
      <div className="grid gap-4 sm:grid-cols-2">
        {result.items.map((r) => (
          <Card key={r.id}>
            <CardContent className="space-y-3 p-6">
              <SectionTitle lang="km">
                {r.nameKm}
              </SectionTitle>
              <p className="text-sm">{r.province}</p>
              <TextLink className="text-sm"
                href={`/admin/reviews/${r.id}`}>
                Review submission
              </TextLink>
            </CardContent>
          </Card>
        ))}
      </div>
      {!result.items.length && <p>No pending submissions on this page.</p>}
      <div className="mt-6 flex gap-6 text-sm text-primary">
        {cursor && (
          <TextLink href="/admin/reviews">
            First page
          </TextLink>
        )}
        {result.nextCursor && (
          <TextLink
            href={`/admin/reviews?cursor=${encodeURIComponent(result.nextCursor)}`}>
            Next page →
          </TextLink>
        )}
      </div>
    </>
  );
}
