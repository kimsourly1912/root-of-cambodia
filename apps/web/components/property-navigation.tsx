import Link from "next/link";
export function PropertyNavigation({
  propertyId,
  active,
}: {
  propertyId: string;
  active: "details" | "rooms" | "information" | "photos";
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
      ].map(([key, label, href]) => (
        <Link
          key={key}
          href={href}
          aria-current={active === key ? "page" : undefined}
          className={`border-b-2 px-1 py-3 text-sm font-medium ${active === key ? "border-primary text-primary" : "border-transparent text-muted-foreground hover:text-primary"}`}
        >
          {label}
        </Link>
      ))}
    </nav>
  );
}
