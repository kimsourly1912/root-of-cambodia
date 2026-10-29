import type { ReviewSnapshot as Snapshot } from "@root-of-cambodia/backend/publication-queries";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
const text = (value: string | null | undefined) => value || "Not provided";
const money = (value: number) => `$${(value / 100).toFixed(2)}`;
export function ReviewSnapshot({
  snapshot: s,
  previewBase,
}: {
  snapshot: Snapshot;
  previewBase?: string;
}) {
  return (
    <div className="min-w-0 space-y-6">
      <Card className="shadow-none">
        <CardHeader>
          <CardTitle>
            <h2>Property details</h2>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4 break-words text-sm">
          <h3 lang="km" className="text-xl font-semibold">
            {s.property.nameKm}
          </h3>
          <p>
            {text(s.property.nameEn)} · {s.property.province}
          </p>
          <p>Owner: {s.property.ownerName}</p>
          <p>
            Check-in: {s.property.checkinTime} · Check-out:{" "}
            {s.property.checkoutTime}
          </p>
          <h3 className="font-semibold">House rules</h3>
          <p className="whitespace-pre-wrap">{s.property.policyText}</p>
          <h3 className="font-semibold">Charges per stay</h3>
          {s.property.charges.length ? (
            <ul>
              {s.property.charges.map((c) => (
                <li key={c.code}>
                  {c.label}: {money(c.amountCents)}
                </li>
              ))}
            </ul>
          ) : (
            <p>No additional charges configured.</p>
          )}
        </CardContent>
      </Card>
      <Card className="shadow-none">
        <CardHeader>
          <CardTitle>
            <h2>Information</h2>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4 break-words text-sm">
          <h3 className="font-semibold">Description</h3>
          <p className="whitespace-pre-wrap">
            {text(s.information.description)}
          </p>
          <h3 className="font-semibold">Address</h3>
          <p className="whitespace-pre-wrap">{text(s.information.address)}</p>
          <h3 className="font-semibold">Facilities</h3>
          <p>{s.information.facilities.join(", ") || "Not provided"}</p>
        </CardContent>
      </Card>
      <Card className="shadow-none">
        <CardHeader>
          <CardTitle>
            <h2>Location &amp; contact</h2>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4 break-words text-sm">
          <p>
            Coordinates:{" "}
            {s.logistics.latitude === null
              ? "Not provided"
              : `${s.logistics.latitude}, ${s.logistics.longitude}`}
          </p>
          <p>Contact name: {text(s.logistics.contactName)}</p>
          <p>Phone: {text(s.logistics.contactPhone)}</p>
          <p>Email: {text(s.logistics.contactEmail)}</p>
          <p className="text-muted-foreground">
            Owner-entered contact details are unverified.
          </p>
          <h3 className="font-semibold">Arrival instructions</h3>
          <p className="whitespace-pre-wrap">
            {text(s.logistics.arrivalInstructions)}
          </p>
        </CardContent>
      </Card>
      <Card className="shadow-none">
        <CardHeader>
          <CardTitle>
            <h2>Rooms, prices &amp; availability</h2>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-5 text-sm">
          {!s.rooms.length && <p>No room types configured.</p>}
          {s.rooms.map((r) => (
            <div key={r.id} className="space-y-1 break-words">
              <h3 className="font-semibold">
                {r.name} · {r.active ? "Active" : "Inactive"}
              </h3>
              <p>
                Capacity: {r.adultCapacity} adults, {r.childCapacity} children,{" "}
                {r.totalCapacity} total
              </p>
              <p>
                {r.configuredNights} configured nights
                {r.minPriceCents !== null &&
                  ` · ${money(r.minPriceCents)}–${money(r.maxPriceCents!)}`}
              </p>
            </div>
          ))}
          <p className="text-muted-foreground">
            Availability is checked again when a booking is requested.
          </p>
        </CardContent>
      </Card>
      <Card className="shadow-none">
        <CardHeader>
          <CardTitle>
            <h2>Photos</h2>
          </CardTitle>
        </CardHeader>
        <CardContent>
          {!s.photos.length && <p className="text-sm">No photos configured.</p>}
          <div className="grid gap-4 sm:grid-cols-2">
            {s.photos.map((p, i) => (
              <figure key={p.id} className="min-w-0">
                {previewBase && p.state === "ready" ? (
                  <img
                    src={`${previewBase}/${p.id}`}
                    alt={`Property photo ${i + 1}`}
                    width={p.width ?? 640}
                    height={p.height ?? 480}
                    className="h-48 w-full rounded-md object-contain bg-secondary"
                  />
                ) : (
                  <p className="text-sm">
                    Photo {i + 1}: {p.state}
                  </p>
                )}
              </figure>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
