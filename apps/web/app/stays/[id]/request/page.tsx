import { notFound } from "next/navigation";
import { guestSession } from "@/server/guest-session";
import { ownerRead } from "@/server/owner-session";
import { requestContext } from "@root-of-cambodia/backend/bookings";
import { DomainError } from "@root-of-cambodia/backend/shared";
import { GuestRequestForm } from "@/features/bookings/components/guest-request-form";
import { PageTitle } from "@/components/typography";
import { TextLink } from "@/components/text-link";
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
          <PageTitle>
            Requests currently unavailable
          </PageTitle>
          <p>
            Approved booking terms have not been configured for this stay. You
            can still browse its listing.
          </p>
          <TextLink href={`/stays/${id}`}>
            Back to stay
          </TextLink>
        </section>
      );
    throw error;
  }
  return (
    <div className="space-y-7">
      <TextLink href={`/stays/${id}`}>
        ← Back to stay
      </TextLink>
      <PageTitle>Request to book</PageTitle>
      <GuestRequestForm context={context} initial={selection.toString()} />
    </div>
  );
}
