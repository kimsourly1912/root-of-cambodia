import Link from "next/link";
import { ownerSession } from "@/src/owner-session";
import { reviewerRead } from "@/src/reviewer-read";
import { reviewQueue } from "@root-of-cambodia/backend/publication-queries";
import { Card, CardContent } from "@/components/ui/card";
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
      <h1 className="text-3xl font-semibold tracking-tight">
        Publication reviews
      </h1>
      <p className="mb-8 mt-3 text-muted-foreground">
        Pending property submissions, oldest first.
      </p>
      <div className="grid gap-4 sm:grid-cols-2">
        {result.items.map((r) => (
          <Card key={r.id} className="shadow-none">
            <CardContent className="space-y-3 p-6">
              <h2 lang="km" className="break-words text-xl font-semibold">
                {r.nameKm}
              </h2>
              <p className="text-sm">{r.province}</p>
              <Link
                href={`/review/${r.id}`}
                className="text-sm font-semibold text-primary underline"
              >
                Review submission
              </Link>
            </CardContent>
          </Card>
        ))}
      </div>
      {!result.items.length && <p>No pending submissions on this page.</p>}
      <div className="mt-6 flex gap-6 text-sm text-primary">
        {cursor && (
          <Link href="/review" className="underline">
            First page
          </Link>
        )}
        {result.nextCursor && (
          <Link
            href={`/review?cursor=${result.nextCursor}`}
            className="underline"
          >
            Next page →
          </Link>
        )}
      </div>
    </>
  );
}
