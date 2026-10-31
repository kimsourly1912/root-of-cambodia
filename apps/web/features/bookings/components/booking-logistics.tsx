import type { LogisticsCopy } from "@root-of-cambodia/backend/bookings";
import { cambodiaTime } from "@/lib/booking-format";
import { SectionTitle } from "@/components/typography";
export function BookingLogistics({
  details,
  heading,
  acceptedAt,
}: {
  details: LogisticsCopy;
  heading: string;
  acceptedAt?: number;
}) {
  return (
    <section className="space-y-4 rounded-xl border bg-card p-6 break-words">
      <SectionTitle>{heading}</SectionTitle>
      {acceptedAt && (
        <p className="text-xs text-muted-foreground">
          Saved at acceptance · {cambodiaTime(acceptedAt)} Cambodia time
        </p>
      )}
      <div>
        <SectionTitle as="h3" size="sm">Exact address</SectionTitle>
        <p className="whitespace-pre-wrap">{details.address}</p>
      </div>
      {details.latitude !== null && (
        <p className="text-sm">
          Coordinates: {details.latitude}, {details.longitude}
        </p>
      )}
      <div className="space-y-1">
        <SectionTitle as="h3" size="sm">Property contact</SectionTitle>
        {details.contactName && <p>{details.contactName}</p>}
        {details.contactPhone && <p>{details.contactPhone}</p>}
        {details.contactEmail && <p>{details.contactEmail}</p>}
      </div>
      <div>
        <SectionTitle as="h3" size="sm">Arrival instructions</SectionTitle>
        <p className="whitespace-pre-wrap">
          {details.arrivalInstructions ||
            "No additional arrival instructions provided."}
        </p>
      </div>
    </section>
  );
}
