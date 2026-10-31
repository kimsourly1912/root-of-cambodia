import Link from "next/link";
import type {
  PublicationReadiness,
  ReadinessItem,
} from "@root-of-cambodia/backend/publication";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";

const items: {
  code: ReadinessItem;
  label: string;
  tab: string;
  action: string;
}[] = [
  {
    code: "basics",
    label: "Verified owner and property basics",
    tab: "",
    action: "Review property details",
  },
  {
    code: "description",
    label: "Property description",
    tab: "/information",
    action: "Add a description",
  },
  {
    code: "address",
    label: "Property address",
    tab: "/information",
    action: "Add an address",
  },
  {
    code: "contact",
    label: "Contact phone or email",
    tab: "/logistics",
    action: "Add a contact method",
  },
  {
    code: "photos",
    label: "At least one finished photo",
    tab: "/photos",
    action: "Add a property photo",
  },
  {
    code: "uploads",
    label: "No unfinished photo uploads",
    tab: "/photos",
    action: "Finish or remove unfinished uploads",
  },
  {
    code: "rooms",
    label: "At least one active room type",
    tab: "/rooms",
    action: "Set up a room type",
  },
  {
    code: "calendar",
    label: "Future nightly price and stock setup",
    tab: "/rooms",
    action: "Set up room prices and stock",
  },
];

export function PublicationChecklist({
  readiness,
  ownerPropertyId,
}: {
  readiness: PublicationReadiness;
  ownerPropertyId?: string;
}) {
  return (
    <Card className="shadow-none">
      <CardHeader>
        <CardTitle>
          <h2>Publication checklist</h2>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4 text-sm">
        <p>
          {readiness.ready
            ? "The required saved listing details are complete. Manual review is still required."
            : "Complete the missing items before submission or approval."}
        </p>
        <ul className="space-y-3">
          {items.map((item) => (
            <li
              key={item.code}
              className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1"
            >
              <span>
                {item.label}:{" "}
                <strong>
                  {readiness.checks[item.code] ? "Ready" : "Needed"}
                </strong>
              </span>
              {!readiness.checks[item.code] && ownerPropertyId && (
                <Link
                  className="underline underline-offset-4"
                  href={`/owner/properties/${ownerPropertyId}${item.tab}`}
                >
                  {item.action}
                </Link>
              )}
            </li>
          ))}
        </ul>
        <p className="text-muted-foreground">
          Set a price and stock for at least one check-in 24 hours ahead or
          later. Guests’ dates and available rooms are checked separately when
          booking.
        </p>
        <p className="text-muted-foreground">
          Three useful photos are recommended. Facilities, map coordinates and
          arrival directions are optional. These checks do not verify listing
          accuracy or service quality.
        </p>
      </CardContent>
    </Card>
  );
}
