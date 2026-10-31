import Link from "next/link";
import { notFound } from "next/navigation";
import { runtime } from "@/server/runtime";
import { publicPage } from "@/server/public-http";
import { publicStay } from "@root-of-cambodia/backend/catalog";
import { PublicStayDetails } from "@/features/catalog/components/public-stay-details";
import { TextLink } from "@/components/text-link";
import { buttonVariants } from "@/components/ui/button";
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
      <TextLink className="mb-8 block w-fit text-sm" href="/stays">
        ← Explore stays
      </TextLink>
      <Link
        href={`/stays/${id}/request`}
        className={buttonVariants({ className: "mb-7" })}
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
