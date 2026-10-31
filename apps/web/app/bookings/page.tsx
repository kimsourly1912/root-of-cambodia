import { guestSession } from "@/server/guest-session";
import { ownerRead } from "@/server/owner-session";
import { guestBookings } from "@root-of-cambodia/backend/bookings";
import { DomainError } from "@root-of-cambodia/backend/shared";
import { usd, bookingStatus } from "@/lib/booking-format";
import { PageTitle, SectionTitle } from "@/components/typography";
import { EmptyState } from "@/components/empty-state";
import { TextLink } from "@/components/text-link";
import { Badge } from "@/components/ui/badge";
export default async function Page({
  searchParams,
}: {
  searchParams: Promise<{ cursor?: string }>;
}) {
  const { cursor } = await searchParams,
    { db, actor } = await guestSession("/bookings");
  let page;
  try {
    page = await ownerRead(() => guestBookings(db, actor, cursor));
  } catch (error) {
    if (error instanceof DomainError && error.code === "invalid_request")
      return (
        <p>
          Invalid page.{" "}
          <TextLink href="/bookings">
            Open My bookings
          </TextLink>
        </p>
      );
    throw error;
  }
  return (
    <div className="space-y-7">
      <PageTitle>My bookings</PageTitle>
      <p className="text-muted-foreground">
        Track your requests and confirmed stays. Payment is made directly to the
        property.
      </p>
      {!!page.drafts.length && (
        <section className="space-y-3 rounded-lg border p-5">
          <SectionTitle size="sm">Saved request reviews</SectionTitle>
          <p className="text-sm">
            These reviews have not produced a confirmed submission. Open one to
            send or recover the same request.
          </p>
          {page.drafts.map((d) => (
            <TextLink className="block"
             
              key={d.id}
              href={`/bookings/requests/${d.id}`}>
              {d.propertyName} · Open saved review
            </TextLink>
          ))}
        </section>
      )}
      {page.items.length ? (
        <ul className="grid gap-5 md:grid-cols-2">
          {page.items.map((b) => (
            <li
              key={b.id}
              className="min-w-0 space-y-3 rounded-xl border bg-card p-5"
            >
              <Badge>
                {bookingStatus(b.status)}
              </Badge>
              <SectionTitle size="sm">
                {b.propertyName}
              </SectionTitle>
              <p>
                {b.checkinDate} → {b.checkoutDate}
              </p>
              <p>{usd(b.totalCents)}</p>
              <TextLink className="inline-block"
               
                href={`/bookings/${b.id}`}>
                View booking
              </TextLink>
            </li>
          ))}
        </ul>
      ) : (
        <EmptyState title="No bookings on this page">
          <TextLink href="/stays">Explore stays</TextLink>
        </EmptyState>
      )}
      <nav aria-label="Booking pages" className="flex gap-6">
        {cursor && (
          <TextLink href="/bookings">
            Newest bookings
          </TextLink>
        )}
        {page.nextCursor && (
          <TextLink
            href={`/bookings?cursor=${encodeURIComponent(page.nextCursor)}`}>
            Older bookings
          </TextLink>
        )}
      </nav>
    </div>
  );
}
