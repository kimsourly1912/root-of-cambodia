import Link from "next/link";
import { LinkPending } from "@/components/link-pending";
export function PropertyNavigation({
  propertyId,
  active,
}: {
  propertyId: string;
  active:
    | "details"
    | "rooms"
    | "information"
    | "photos"
    | "logistics"
    | "review"
    | "bookings"
    | "availability";
}) {
  const base = `/owner/properties/${propertyId}`;
  return (
    <nav
      aria-label="Property setup"
      className="mb-8 mt-6 flex flex-wrap gap-x-6 gap-y-1 border-b"
    >
      {[
        ["details", "Property details", base],
        ["rooms", "Room types", base + "/rooms"],
        ["information", "Information", base + "/information"],
        ["photos", "Photos", base + "/photos"],
        ["logistics", "Location & contact", base + "/logistics"],
        ["review", "Publication review", base + "/review"],
        ["bookings", "Bookings", base + "/bookings"],
        ["availability", "Availability", base + "/availability"],
      ].map(([key, label, href]) => (
        <Link
          key={key}
          href={href}
          aria-current={active === key ? "page" : undefined}
          className={`relative border-b-2 px-1 py-3 text-sm font-medium ${active === key ? "border-primary text-primary" : "border-transparent text-muted-foreground hover:text-primary"}`}
        >
          {label}
          <LinkPending />
        </Link>
      ))}
    </nav>
  );
}
