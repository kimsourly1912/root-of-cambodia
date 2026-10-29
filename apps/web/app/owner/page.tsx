import { canReview } from "@root-of-cambodia/backend/publication-queries";
import Link from "next/link";
import { ownerSession, ownerRead } from "@/src/owner-session";
import { ownerProperties } from "@root-of-cambodia/backend/property-queries";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
export default async function Page({
  searchParams,
}: {
  searchParams: Promise<{ cursor?: string }>;
}) {
  const { db, actor } = await ownerSession();
  const { cursor } = await searchParams;
  const result = await ownerRead(() =>
    ownerProperties(db, actor, typeof cursor === "string" ? cursor : ""),
  );
  const reviewer = await ownerRead(() => canReview(db, actor));
  return (
    <>
      <div className="mb-8 flex flex-wrap items-start justify-between gap-5">
        <div>
          <p lang="km" className="mb-2 text-sm text-primary">
            កន្លែងស្នាក់នៅរបស់អ្នក
          </p>
          <h1 className="text-3xl font-semibold tracking-tight">
            Your properties
          </h1>
          <p className="mt-3 max-w-xl text-muted-foreground">
            A quiet place to get the details ready. Drafts are private and
            cannot receive bookings.
          </p>
        </div>
        <div className="flex flex-wrap gap-4">
          {reviewer && (
            <Button variant="outline" asChild>
              <Link href="/review">Publication reviews</Link>
            </Button>
          )}
          <Button asChild>
            <Link href="/owner/properties/new">+ New property draft</Link>
          </Button>
        </div>
      </div>
      {result.items.length ? (
        <div className="grid gap-4 sm:grid-cols-2">
          {result.items.map((property) => (
            <Card key={property.id} className="shadow-none">
              <CardContent className="p-6">
                <div className="mb-4 flex items-center justify-between gap-3">
                  <span className="rounded-full bg-secondary px-3 py-1 text-xs font-medium capitalize">
                    {property.publication}
                  </span>
                  <span className="text-xs text-muted-foreground">
                    Revision {property.revision}
                  </span>
                </div>
                <h2 lang="km" className="break-words text-xl font-semibold">
                  {property.nameKm}
                </h2>
                {property.nameEn && (
                  <p className="break-words text-sm text-muted-foreground">
                    {property.nameEn}
                  </p>
                )}
                <p className="my-4 text-sm">{property.province}</p>
                <Link
                  href={`/owner/properties/${property.id}`}
                  className="text-sm font-semibold text-primary underline underline-offset-4"
                >
                  Open property →
                </Link>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : (
        <Card className="shadow-none">
          <CardContent className="py-14 text-center">
            <span
              className="inline-flex h-14 w-14 items-center justify-center rounded-full bg-secondary text-2xl text-primary"
              aria-hidden="true"
            >
              ⌂
            </span>
            <h2 className="mt-5 text-xl font-semibold">
              {cursor
                ? "No more properties"
                : "Your first property starts here"}
            </h2>
            <p className="mx-auto mt-3 max-w-md text-sm text-muted-foreground">
              {cursor
                ? "Return to the first page to see your saved properties."
                : "Add the name, location and house rules. You can save a draft and return to it later."}
            </p>
            <Button asChild className="mt-6">
              <Link href={cursor ? "/owner" : "/owner/properties/new"}>
                {cursor ? "First page" : "Create property draft"}
              </Link>
            </Button>
          </CardContent>
        </Card>
      )}
      <div className="mt-6 flex gap-6 text-sm text-primary">
        {cursor && (
          <Link href="/owner" className="underline">
            First page
          </Link>
        )}
        {result.nextCursor && (
          <Link
            href={`/owner?cursor=${encodeURIComponent(result.nextCursor)}`}
            className="underline"
          >
            Next page →
          </Link>
        )}
      </div>
      <p className="mt-8 text-xs text-muted-foreground">
        Open a property to prepare its details, rooms, prices and photos, then
        submit it for publication review.
      </p>
    </>
  );
}
