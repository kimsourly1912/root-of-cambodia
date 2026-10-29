import Link from "next/link";
import { notFound } from "next/navigation";
import { runtime } from "@/src/runtime";
import { publicPage } from "@/src/public-http";
import { publicStay } from "@root-of-cambodia/backend/catalog-queries";
import { PublicStayDetails } from "@/components/public-stay-details";
export default async function Page({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const listing = await publicPage(async () =>
    publicStay((await runtime()).env.DB, id),
  );
  if (!listing) notFound();
  return (
    <>
      <Link
        href="/stays"
        className="mb-8 inline-block text-sm text-primary underline"
      >
        ← Explore stays
      </Link>
      <Link
        href={`/stays/${id}/request`}
        className="mb-7 block w-fit rounded-md bg-primary px-5 py-3 text-sm font-medium text-primary-foreground"
      >
        Request to book
      </Link>
      <PublicStayDetails
        listing={listing}
        photoBase={`/api/stays/${id}/photos`}
      />
    </>
  );
}
