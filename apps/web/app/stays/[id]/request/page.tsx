import Link from "next/link";
import { notFound } from "next/navigation";
import { guestSession } from "@/src/guest-session";
import { ownerRead } from "@/src/owner-session";
import { requestContext } from "@root-of-cambodia/backend/guest-bookings";
import { DomainError } from "@root-of-cambodia/backend/errors";
import { GuestRequestForm } from "@/components/guest-request-form";
export const dynamic = "force-dynamic";
export default async function Page({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { id } = await params,
    raw = await searchParams,
    selection = new URLSearchParams();
  for (const [key, value] of Object.entries(raw))
    if (typeof value === "string" && value.length <= 128)
      selection.set(key, value);
  const next = `/stays/${id}/request${selection.size ? "?" + selection : ""}`;
  const { db, actor } = await guestSession(next);
  let context;
  try {
    context = await ownerRead(() => requestContext(db, actor, id));
  } catch (error) {
    if (error instanceof DomainError && error.code === "not_found") notFound();
    if (
      error instanceof DomainError &&
      error.code === "booking_terms_unavailable"
    )
      return (
        <section className="space-y-5">
          <h1 className="text-3xl font-semibold">
            Requests currently unavailable
          </h1>
          <p>
            Approved booking terms have not been configured for this stay. You
            can still browse its listing.
          </p>
          <Link href={`/stays/${id}`} className="text-primary underline">
            Back to stay
          </Link>
        </section>
      );
    throw error;
  }
  return (
    <div className="space-y-7">
      <Link href={`/stays/${id}`} className="text-primary underline">
        ← Back to stay
      </Link>
      <h1 className="text-3xl font-semibold">Request to book</h1>
      <GuestRequestForm context={context} initial={selection.toString()} />
    </div>
  );
}
