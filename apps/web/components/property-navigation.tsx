import Link from "next/link";
export function PropertyNavigation({
  propertyId,
  active,
}: {
  propertyId: string;
  active: "details" | "rooms";
}) {
  const base = `/owner/properties/${propertyId}`;
  return (
    <nav aria-label="Property setup" className="mb-8 mt-6 flex gap-6 border-b">
      {[
        ["details", "Property details", base],
        ["rooms", "Room types", base + "/rooms"],
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
