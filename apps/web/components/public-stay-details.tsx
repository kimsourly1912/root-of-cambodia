import type { PublicListing } from "@root-of-cambodia/backend/public-listing";
import { StayPhoto } from "@/components/stay-photo";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
export function PublicStayDetails({
  listing,
  photoBase,
  heading = "h1",
}: {
  listing: PublicListing;
  photoBase?: string;
  heading?: "h1" | "h3";
}) {
  const Heading = heading,
    Section = heading === "h1" ? "h2" : "h4";
  return (
    <div className="min-w-0 space-y-7 break-words">
      <div>
        <p className="mb-2 text-sm font-medium text-primary">
          {listing.province} · Cambodia
        </p>
        <Heading
          lang="km"
          className="text-3xl font-semibold tracking-tight sm:text-4xl"
        >
          {listing.nameKm}
        </Heading>
        {listing.nameEn && (
          <p className="mt-2 text-lg text-muted-foreground">{listing.nameEn}</p>
        )}
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        {listing.photos.map((photo, index) => (
          <StayPhoto
            key={photo.id}
            src={photoBase ? `${photoBase}/${photo.id}` : undefined}
            alt={`Property photo ${index + 1} of ${listing.nameEn || listing.nameKm}`}
            eager={index === 0}
          />
        ))}
      </div>
      <Card className="shadow-none">
        <CardHeader>
          <CardTitle>
            <Section>About this stay</Section>
          </CardTitle>
        </CardHeader>
        <CardContent className="whitespace-pre-wrap leading-relaxed">
          {listing.description}
        </CardContent>
      </Card>
      {!!listing.facilities.length && (
        <Card className="shadow-none">
          <CardHeader>
            <CardTitle>
              <Section>Facilities</Section>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="grid gap-3 sm:grid-cols-2">
              {listing.facilities.map((facility) => (
                <li
                  key={facility}
                  className="rounded-md bg-secondary px-3 py-2 text-sm"
                >
                  {facility}
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      )}
      <Card className="shadow-none">
        <CardHeader>
          <CardTitle>
            <Section>Room options</Section>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {listing.rooms.map((room) => (
            <div key={room.id} className="rounded-lg border p-4">
              <p className="font-semibold">{room.name}</p>
              <p className="mt-2 text-sm text-muted-foreground">
                Per unit: up to {room.adultCapacity} adults,{" "}
                {room.childCapacity} children · {room.totalCapacity} guests
                total
              </p>
            </div>
          ))}
        </CardContent>
      </Card>
      <Card className="shadow-none">
        <CardHeader>
          <CardTitle>
            <Section>Stay information</Section>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-5 text-sm">
          <p>
            Check-in: {listing.checkinTime} · Check-out: {listing.checkoutTime}{" "}
            · Cambodia time
          </p>
          <div>
            <p className="mb-2 font-semibold">House rules</p>
            <p className="whitespace-pre-wrap">{listing.policyText}</p>
          </div>
          <div>
            <p className="mb-2 font-semibold">Listed charges per stay</p>
            {listing.charges.length ? (
              <ul className="space-y-2">
                {listing.charges.map((charge) => (
                  <li key={charge.code}>
                    {charge.label}: ${(charge.amountCents / 100).toFixed(2)} USD
                  </li>
                ))}
              </ul>
            ) : (
              <p>No additional per-stay charges listed.</p>
            )}
          </div>
          <p className="text-muted-foreground">Payment at the property.</p>
        </CardContent>
      </Card>
    </div>
  );
}
