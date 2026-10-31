import { canReview } from "@root-of-cambodia/backend/publication";
import Link from "next/link";
import { ownerSession, ownerRead, readTogether } from "@/server/owner-session";
import { ownerProperties } from "@root-of-cambodia/backend/properties";
import { buttonVariants } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { PageTitle, SectionTitle } from "@/components/typography";
import { EmptyState } from "@/components/empty-state";
import { TextLink } from "@/components/text-link";
import { Badge } from "@/components/ui/badge";
export default async function Page({
  searchParams,
}: {
  searchParams: Promise<{ cursor?: string }>;
}) {
  const { db, actor } = await ownerSession();
  const { cursor } = await searchParams;
  const [result, reviewer] = await readTogether(
    ownerRead(() =>
      ownerProperties(db, actor, typeof cursor === "string" ? cursor : ""),
    ),
    ownerRead(() => canReview(db, actor)),
  );
  return (
    <>
      <div className="mb-8 flex flex-wrap items-start justify-between gap-5">
        <div>
          <p lang="km" className="mb-2 text-sm text-primary">
            កន្លែងស្នាក់នៅរបស់អ្នក
          </p>
          <PageTitle>
            Your properties
          </PageTitle>
          <p className="mt-3 max-w-xl text-muted-foreground">
            A quiet place to get the details ready. Drafts are private and
            cannot receive bookings.
          </p>
        </div>
        <div className="flex flex-wrap gap-4">
          {reviewer && (
            <Link href="/review" className={buttonVariants({ variant: "outline" })}>
              Publication reviews
            </Link>
          )}
          <Link href="/owner/properties/new" className={buttonVariants()}>
            + New property draft
          </Link>
        </div>
      </div>
      {result.items.length ? (
        <div className="grid gap-4 sm:grid-cols-2">
          {result.items.map((property) => (
            <Card key={property.id}>
              <CardContent className="p-6">
                <div className="mb-4 flex items-center justify-between gap-3">
                  <Badge className="capitalize">
                    {property.publication}
                  </Badge>
                  <span className="text-xs text-muted-foreground">
                    Revision {property.revision}
                  </span>
                </div>
                <SectionTitle lang="km">
                  {property.nameKm}
                </SectionTitle>
                {property.nameEn && (
                  <p className="break-words text-sm text-muted-foreground">
                    {property.nameEn}
                  </p>
                )}
                <p className="my-4 text-sm">{property.province}</p>
                <TextLink className="text-sm"
                  href={`/owner/properties/${property.id}`}>
                  Open property →
                </TextLink>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : (
        <EmptyState
          icon="⌂"
          title={cursor ? "No more properties" : "Your first property starts here"}
          description={
            cursor
              ? "Return to the first page to see your saved properties."
              : "Add the name, location and house rules. You can save a draft and return to it later."
          }
        >
          <Link
            href={cursor ? "/owner" : "/owner/properties/new"}
            className={buttonVariants()}
          >
            {cursor ? "First page" : "Create property draft"}
          </Link>
        </EmptyState>
      )}
      <div className="mt-6 flex gap-6 text-sm text-primary">
        {cursor && (
          <TextLink href="/owner">
            First page
          </TextLink>
        )}
        {result.nextCursor && (
          <TextLink
            href={`/owner?cursor=${encodeURIComponent(result.nextCursor)}`}>
            Next page →
          </TextLink>
        )}
      </div>
      <p className="mt-8 text-xs text-muted-foreground">
        Open a property to prepare its details, rooms, prices and photos, then
        submit it for publication review.
      </p>
    </>
  );
}
