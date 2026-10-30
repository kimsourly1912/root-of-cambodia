import type { LogisticsCopy } from "@root-of-cambodia/backend/booking-logistics";
import { cambodiaTime } from "./booking-format";
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
      <h2 className="text-xl font-semibold">{heading}</h2>
      {acceptedAt && (
        <p className="text-xs text-muted-foreground">
          Saved at acceptance · {cambodiaTime(acceptedAt)} Cambodia time
        </p>
      )}
      <div>
        <h3 className="font-semibold">Exact address</h3>
        <p className="whitespace-pre-wrap">{details.address}</p>
      </div>
      {details.latitude !== null && (
        <p className="text-sm">
          Coordinates: {details.latitude}, {details.longitude}
        </p>
      )}
      <div className="space-y-1">
        <h3 className="font-semibold">Property contact</h3>
        {details.contactName && <p>{details.contactName}</p>}
        {details.contactPhone && <p>{details.contactPhone}</p>}
        {details.contactEmail && <p>{details.contactEmail}</p>}
      </div>
      <div>
        <h3 className="font-semibold">Arrival instructions</h3>
        <p className="whitespace-pre-wrap">
          {details.arrivalInstructions ||
            "No additional arrival instructions provided."}
        </p>
      </div>
    </section>
  );
}
