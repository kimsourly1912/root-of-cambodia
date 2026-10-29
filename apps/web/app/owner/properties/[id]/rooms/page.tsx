import Link from "next/link";
import { notFound } from "next/navigation";
import { ownerSession, ownerRead } from "@/src/owner-session";
import { ownerProperty } from "@root-of-cambodia/backend/property-queries";
import { ownerRoomTypes } from "@root-of-cambodia/backend/room-queries";
import { DomainError } from "@root-of-cambodia/backend/errors";
import { PropertyNavigation } from "@/components/property-navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
export default async function Page({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ cursor?: string }>;
}) {
  const { db, actor } = await ownerSession();
  const { id } = await params;
  const { cursor } = await searchParams;
  const data = await ownerRead(async () => {
    try {
      const property = await ownerProperty(db, actor, id);
      return {
        property,
        ...(await ownerRoomTypes(
          db,
          actor,
          id,
          typeof cursor === "string" ? cursor : "",
        )),
      };
    } catch (error) {
      if (error instanceof DomainError && error.code === "not_found")
        return null;
      throw error;
    }
  });
  if (!data) notFound();
  const base = `/owner/properties/${id}/rooms`;
  return (
    <>
      <p lang="km" className="mb-2 break-words text-sm text-primary">
        {data.property.nameKm}
      </p>
      <div className="flex flex-wrap items-start justify-between gap-5">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight">Room types</h1>
          <p className="mt-3 text-muted-foreground">
            Organise the kinds of rooms guests can choose from.
          </p>
        </div>
        {data.property.publication === "draft" && (
          <Button asChild>
            <Link href={base + "/new"}>+ Add room type</Link>
          </Button>
        )}
      </div>
      <PropertyNavigation propertyId={id} active="rooms" />
      {data.items.length ? (
        <div className="grid gap-4 sm:grid-cols-2">
          {data.items.map((room) => (
            <Card key={room.id} className="shadow-none">
              <CardContent className="space-y-4 p-6">
                <h2 className="break-words text-xl font-semibold">
                  {room.name}
                </h2>
                <dl className="grid grid-cols-3 gap-3 text-sm">
                  {[
                    ["Adults", room.adultCapacity],
                    ["Children", room.childCapacity],
                    ["Total guests", room.totalCapacity],
                  ].map(([label, value]) => (
                    <div key={label}>
                      <dt className="text-xs text-muted-foreground">{label}</dt>
                      <dd className="mt-1 font-semibold">{value}</dd>
                    </div>
                  ))}
                </dl>
                <Link
                  href={base + "/" + room.id}
                  className="inline-block py-2 text-sm font-semibold text-primary underline underline-offset-4"
                >
                  Open room type →
                </Link>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : (
        <Card className="shadow-none">
          <CardContent className="py-14 text-center">
            <h2 className="text-xl font-semibold">
              {cursor ? "No more room types" : "No room types yet"}
            </h2>
            <p className="mx-auto mt-3 max-w-md text-sm text-muted-foreground">
              {cursor
                ? "Return to the first page to see your saved room types."
                : "Start with a name and guest limits. Configure prices and dated availability from a saved room type."}
            </p>
            {data.property.publication === "draft" && !cursor && (
              <Button asChild className="mt-6">
                <Link href={base + "/new"}>Create first room type</Link>
              </Button>
            )}
          </CardContent>
        </Card>
      )}
      <div className="mt-6 flex gap-6 text-sm text-primary">
        {cursor && (
          <Link href={base} className="underline">
            First page
          </Link>
        )}
        {data.nextCursor && (
          <Link
            href={base + "?cursor=" + encodeURIComponent(data.nextCursor)}
            className="underline"
          >
            Next page →
          </Link>
        )}
      </div>
      <p className="mt-8 text-xs text-muted-foreground">
        Adding a room type does not create available units or accept bookings.
      </p>
    </>
  );
}
