import Link from "next/link";
import { runtime } from "@/server/runtime";
import { publicPage } from "@/server/public-http";
import {
  browseInput,
  browseStays,
  type BrowseInput,
} from "@root-of-cambodia/backend/catalog";
import { StayPhoto } from "@/features/catalog/components/stay-photo";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button, buttonVariants } from "@/components/ui/button";
import { PageTitle, SectionTitle } from "@/components/typography";
import { EmptyState } from "@/components/empty-state";
import { TextLink } from "@/components/text-link";
import { Alert } from "@/components/ui/alert";
export default async function Page({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  let input: BrowseInput = { q: "", province: "", cursor: "" },
    invalid = false;
  try {
    input = browseInput(await searchParams);
  } catch {
    invalid = true;
  }
  const result = invalid
    ? null
    : await publicPage(async () =>
        browseStays((await runtime()).env.DB, input),
      );
  const next = new URLSearchParams();
  if (input.q) next.set("q", input.q);
  if (input.province) next.set("province", input.province);
  if (result?.nextCursor) next.set("cursor", result.nextCursor);
  return (
    <>
      <div className="max-w-2xl">
        <p className="mb-3 text-sm font-medium text-primary">
          Root of Cambodia
        </p>
        <PageTitle size="hero">
          Stays in Cambodia
        </PageTitle>
        <p className="mt-4 leading-relaxed text-muted-foreground">
          Explore accommodation from participating property owners.
        </p>
      </div>
      <form
        action="/stays"
        method="get"
        className="my-8 grid items-end gap-4 rounded-xl border bg-card p-5 sm:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_auto]"
      >
        <div className="min-w-0 space-y-2">
          <Label htmlFor="stay-search">Property name</Label>
          <Input
            id="stay-search"
            name="q"
            defaultValue={input.q}
            maxLength={100}
            placeholder="Search in Khmer or English"
          />
        </div>
        <div className="min-w-0 space-y-2">
          <Label htmlFor="stay-province">Province</Label>
          <Input
            id="stay-province"
            name="province"
            defaultValue={input.province}
            maxLength={100}
            placeholder="For example, Kampot"
          />
        </div>
        <Button type="submit">Search stays</Button>
      </form>
      {(input.q || input.province || input.cursor || invalid) && (
        <TextLink className="mb-6 inline-block text-sm"
          href="/stays">
          Clear search
        </TextLink>
      )}
      {invalid ? (
        <Alert role="alert">
          Check the search details and try again.
        </Alert>
      ) : !result?.items.length ? (
        <EmptyState
          title="No stays found"
          description="Try another name or province, or check back for new listings."
        />
      ) : (
        <>
          <p className="mb-5 text-sm text-muted-foreground">
            Showing {result.items.length}{" "}
            {result.items.length === 1 ? "stay" : "stays"}
          </p>
          <ul className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {result.items.map((stay, index) => (
              <li
                key={stay.id}
                className="min-w-0 overflow-hidden rounded-xl border bg-card"
              >
                <Link
                  href={`/stays/${stay.id}`}
                  className="block p-3 focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary"
                >
                  <StayPhoto
                    src={
                      stay.cover
                        ? `/api/stays/${stay.id}/photos/${stay.cover.id}`
                        : undefined
                    }
                    alt={`Cover photo of ${stay.nameEn || stay.nameKm}`}
                    eager={index === 0}
                  />
                  <div className="space-y-2 px-1 pb-2 pt-4 break-words">
                    <p className="text-sm text-primary">{stay.province}</p>
                    <SectionTitle lang="km">
                      {stay.nameKm}
                    </SectionTitle>
                    {stay.nameEn && (
                      <p className="text-sm text-muted-foreground">
                        {stay.nameEn}
                      </p>
                    )}
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        </>
      )}
      {result?.nextCursor && (
        <div className="mt-10 flex justify-center">
          <Link
            href={`/stays?${next.toString()}`}
            className={buttonVariants({ variant: "outline" })}
          >
            More stays →
          </Link>
        </div>
      )}
    </>
  );
}
