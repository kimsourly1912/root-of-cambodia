import Link from "next/link";
import { redirect } from "next/navigation";
import { guestSession } from "@/server/guest-session";
import { ownerRead } from "@/server/owner-session";
import { guestAttempt } from "@root-of-cambodia/backend/bookings";
import { DomainError } from "@root-of-cambodia/backend/shared";
import { BookingReview } from "@/features/bookings/components/booking-review";
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
          <h1 className="text-3xl font-semibold">Saved review unavailable</h1>
          <p>
            This review is not available to your account. If saving was
            interrupted, reload to check again. Preparing a review never sends a
            booking.
          </p>
          <a
            href={`/bookings/requests/${id}`}
            className="block text-primary underline"
          >
            Check again
          </a>
          <Link href="/bookings" className="block text-primary underline">
            My bookings
          </Link>
        </section>
      );
    throw error;
  }
  if (attempt.receipt) redirect(`/bookings/${attempt.receipt.id}`);
  return (
    <div className="space-y-7">
      <h1 className="text-3xl font-semibold">Review your stay</h1>
      <BookingReview id={id} preview={attempt.preview} />
    </div>
  );
}
