import { redirect } from "next/navigation";
import { guestSession } from "@/server/guest-session";
import { ownerRead } from "@/server/owner-session";
import { guestAttempt } from "@root-of-cambodia/backend/bookings";
import { DomainError } from "@root-of-cambodia/backend/shared";
import { BookingReview } from "@/features/bookings/components/booking-review";
import { PageTitle } from "@/components/typography";
import { TextLink, textLinkClass } from "@/components/text-link";
import { cn } from "@/lib/utils";
export default async function Page({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params,
    { db, actor } = await guestSession(`/bookings/requests/${id}`);
  let attempt;
  try {
    attempt = await ownerRead(() => guestAttempt(db, actor, id));
  } catch (error) {
    if (error instanceof DomainError && error.code === "not_found")
      return (
        <section className="space-y-5">
          <PageTitle>Saved review unavailable</PageTitle>
          <p>
            This review is not available to your account. If saving was
            interrupted, reload to check again. Preparing a review never sends a
            booking.
          </p>
          <a
            href={`/bookings/requests/${id}`}
            className={cn(textLinkClass, "block")}
          >
            Check again
          </a>
          <TextLink className="block" href="/bookings">
            My bookings
          </TextLink>
        </section>
      );
    throw error;
  }
  if (attempt.receipt) redirect(`/bookings/${attempt.receipt.id}`);
  return (
    <div className="space-y-7">
      <PageTitle>Review your stay</PageTitle>
      <BookingReview id={id} preview={attempt.preview} />
    </div>
  );
}
