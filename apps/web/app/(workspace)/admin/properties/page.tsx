import Link from "next/link";
import { ownerSession, readOrNotFound } from "@/server/owner-session";
import { adminProperties, PUBLICATION_STATES } from "@root-of-cambodia/backend/platform-admin";
import { PageTitle } from "@/components/typography";
import { EmptyState } from "@/components/empty-state";
import { TextLink } from "@/components/text-link";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";

export const metadata = { title: "All properties" };

const labels: Record<string, string> = {
  "": "All",
  draft: "Draft",
  review: "In review",
  published: "Published",
  paused: "Paused",
};

export default async function Page({
  searchParams,
}: {
  searchParams: Promise<{ publication?: string; cursor?: string }>;
}) {
  const { db, actor } = await ownerSession("/admin/properties");
  const params = await searchParams;
  const publication = (PUBLICATION_STATES as readonly string[]).includes(params.publication ?? "")
    ? params.publication!
    : "";
  const cursor = typeof params.cursor === "string" ? params.cursor : "";
  const result = await readOrNotFound(() => adminProperties(db, actor, { publication, cursor }));
  const href = (state: string, next = "") => {
    const query = new URLSearchParams();
    if (state) query.set("publication", state);
    if (next) query.set("cursor", next);
    const text = query.toString();
    return "/admin/properties" + (text ? "?" + text : "");
  };
  return (
    <div className="space-y-6">
      <div>
        <PageTitle>All properties</PageTitle>
        <p className="mt-3 max-w-2xl text-muted-foreground">
          Every property on the platform with its listing state. Read-only: owners manage their
          own properties, and private details stay with them.
        </p>
      </div>
      <nav aria-label="Listing state" className="flex flex-wrap gap-2">
        {["", ...PUBLICATION_STATES].map((state) => (
          <Link
            key={state || "all"}
            href={href(state)}
            aria-current={state === publication ? "page" : undefined}
            className={buttonVariants({ variant: state === publication ? "default" : "outline", size: "sm" })}
          >
            {labels[state]}
          </Link>
        ))}
      </nav>
      {result.items.length ? (
        <ul className="divide-y rounded-xl border bg-card">
          {result.items.map((item) => (
            <li key={item.id} className="flex flex-wrap items-start justify-between gap-3 p-4 sm:p-5">
              <div className="min-w-0 space-y-1">
                <p lang="km" className="break-words font-medium">{item.nameKm}</p>
                {item.nameEn && <p className="break-words text-sm text-muted-foreground">{item.nameEn}</p>}
                <p className="text-sm text-muted-foreground">
                  {item.province} · {item.ownerName} · {item.roomTypes} room {item.roomTypes === 1 ? "type" : "types"}
                </p>
              </div>
              <Badge variant={item.publication === "published" ? "default" : "secondary"}>
                {labels[item.publication]}
              </Badge>
            </li>
          ))}
        </ul>
      ) : (
        <EmptyState
          title={cursor ? "No more properties" : "No properties in this state"}
          description={cursor ? "Return to the first page." : "Choose another listing state."}
        >
          {(cursor || publication) && <TextLink href={href(cursor ? publication : "")}>{cursor ? "First page" : "Show all"}</TextLink>}
        </EmptyState>
      )}
      <div className="flex gap-6 text-sm">
        {cursor && <TextLink href={href(publication)}>First page</TextLink>}
        {result.nextCursor && <TextLink href={href(publication, result.nextCursor)}>Next page →</TextLink>}
      </div>
    </div>
  );
}
