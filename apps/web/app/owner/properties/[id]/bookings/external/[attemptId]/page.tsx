import Link from "next/link";
import { redirect } from "next/navigation";
import { ownerSession, ownerRead } from "@/server/owner-session";
import { externalReview } from "@root-of-cambodia/backend/external-bookings";
import { DomainError } from "@root-of-cambodia/backend/shared";
import { ExternalReservationReview } from "@/features/external-bookings/components/external-reservation-review";
export default async function Page({params}: {params: Promise<{id: string; attemptId: string}>}) {
  const {id, attemptId} = await params, base = `/owner/properties/${id}/bookings/external`;
  const path = base + "/" + attemptId, {db, actor} = await ownerSession(path);
  let review;
  try { review = await ownerRead(() => externalReview(db, actor, id, attemptId)); }
  catch (error) {
    if (error instanceof DomainError && error.code === "not_found") return <section className="space-y-5">
      <h1 className="text-2xl font-semibold">Saved external review unavailable</h1>
      <p>This review is unavailable to your account or was not saved. Preparing a review never reserves rooms.</p>
      <a href={path} className="block text-primary underline">Check this review again</a>
      <Link href={base} className="block text-primary underline">Prepare a new external review</Link>
    </section>;
    throw error;
  }
  if (review.receipt) redirect(`/owner/properties/${id}/bookings/${review.receipt.id}`);
  return <ExternalReservationReview propertyId={id} review={review} base={base} />;
}
