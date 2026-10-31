import Link from "next/link";
import { ownerSession, readOrNotFound } from "@/server/owner-session";
import { adminOverview } from "@root-of-cambodia/backend/platform-admin";
import { PageTitle, SectionTitle } from "@/components/typography";
import { Card, CardContent } from "@/components/ui/card";
import { buttonVariants } from "@/components/ui/button";
import { TextLink } from "@/components/text-link";

export const metadata = { title: "Admin" };

export default async function Page() {
  const { db, actor } = await ownerSession("/admin");
  const overview = await readOrNotFound(() => adminOverview(db, actor));
  const queues = [
    {
      title: "Owner applications",
      count: overview.pendingOwnerApplications,
      waiting: "waiting for a decision",
      href: "/admin/owners",
      action: "Open owner applications",
    },
    {
      title: "Publication reviews",
      count: overview.pendingPublicationReviews,
      waiting: "waiting for review",
      href: "/admin/reviews",
      action: "Open review queue",
    },
  ];
  const states = [
    ["Draft", overview.properties.draft, "draft"],
    ["In review", overview.properties.review, "review"],
    ["Published", overview.properties.published, "published"],
    ["Paused", overview.properties.paused, "paused"],
  ] as const;
  return (
    <div className="space-y-8">
      <div>
        <PageTitle>Admin</PageTitle>
        <p className="mt-3 max-w-2xl text-muted-foreground">
          Work waiting for the platform team, and the state of listings across the platform.
          Guest and booking details are not shown here.
        </p>
      </div>
      <section className="space-y-4" aria-labelledby="admin-queues">
        <SectionTitle id="admin-queues">Waiting for you</SectionTitle>
        <div className="grid gap-4 sm:grid-cols-2">
          {queues.map((queue) => (
            <Card key={queue.href}>
              <CardContent className="space-y-3 p-6">
                <SectionTitle as="h3" size="sm">{queue.title}</SectionTitle>
                <p>
                  <span className="text-2xl font-semibold">{queue.count}</span>{" "}
                  <span className="text-sm text-muted-foreground">{queue.waiting}</span>
                </p>
                <Link href={queue.href} className={buttonVariants({ variant: queue.count ? "default" : "outline" })}>
                  {queue.action}
                </Link>
              </CardContent>
            </Card>
          ))}
        </div>
      </section>
      <section className="space-y-4" aria-labelledby="admin-listings">
        <SectionTitle id="admin-listings">Listings</SectionTitle>
        <dl className="grid grid-cols-2 gap-4 lg:grid-cols-4">
          {states.map(([label, count, state]) => (
            <div key={state} className="space-y-1 rounded-xl border bg-card p-5">
              <dt className="text-sm text-muted-foreground">{label}</dt>
              <dd className="text-2xl font-semibold">{count}</dd>
              <dd>
                <TextLink className="text-sm" href={"/admin/properties?publication=" + state}>
                  View {label.toLowerCase()}
                </TextLink>
              </dd>
            </div>
          ))}
        </dl>
        <p className="text-sm text-muted-foreground">
          {overview.approvedOwners} approved owners · {overview.activeAdmins} active admins
        </p>
      </section>
    </div>
  );
}
