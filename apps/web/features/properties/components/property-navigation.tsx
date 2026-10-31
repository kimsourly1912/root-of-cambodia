import { IntentLink } from "@/components/intent-link";
import { LinkPending } from "@/components/link-pending";
import { SkeletonLine } from "@/components/page-skeleton";
// Key, label, path below the property, and the label's width for the skeleton.
const tabs = [
  ["details", "Property details", "", "w-28"],
  ["rooms", "Room types", "/rooms", "w-18"],
  ["information", "Information", "/information", "w-20"],
  ["photos", "Photos", "/photos", "w-12"],
  ["logistics", "Location & contact", "/logistics", "w-32"],
  ["review", "Publication review", "/review", "w-32"],
  ["bookings", "Bookings", "/bookings", "w-16"],
  ["availability", "Availability", "/availability", "w-21"],
] as const;
export type PropertyTab = (typeof tabs)[number][0];
export function PropertyNavigation({
  propertyId,
  active,
}: {
  propertyId: string;
  active: PropertyTab;
}) {
  const base = `/owner/properties/${propertyId}`;
  return (
    <nav
      aria-label="Property setup"
      className="mb-8 mt-6 flex flex-wrap gap-x-6 gap-y-1 border-b"
    >
      {tabs.map(([key, label, path]) => (
        <IntentLink
          key={key}
          href={base + path}
          aria-current={active === key ? "page" : undefined}
          className={`relative border-b-2 px-1 py-3 text-sm font-medium ${active === key ? "border-primary text-primary" : "border-transparent text-muted-foreground hover:text-primary"}`}
        >
          {label}
          <LinkPending />
        </IntentLink>
      ))}
    </nav>
  );
}
// The same tab row while a property page loads, with the destination tab marked.
export function PropertyNavigationSkeleton({ active }: { active?: PropertyTab }) {
  return (
    <div className="mb-8 mt-6 flex flex-wrap gap-x-6 gap-y-1 border-b">
      {tabs.map(([key, , , width]) => (
        <div
          key={key}
          className={`border-b-2 px-1 py-3 ${active === key ? "border-primary" : "border-transparent"}`}
        >
          <SkeletonLine size="sm" className={width} />
        </div>
      ))}
    </div>
  );
}
