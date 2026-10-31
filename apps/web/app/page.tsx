import Link from "next/link";
import { FileText, House, Mail, Settings } from "lucide-react";
import { browseStays } from "@root-of-cambodia/backend/catalog";
import { runtime } from "@/server/runtime";
import { publicPage } from "@/server/public-http";
import { Button, buttonVariants } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { PageContainer } from "@/components/page-container";
import { PageTitle, SectionTitle } from "@/components/typography";
import { EmptyState } from "@/components/empty-state";
import { TextLink } from "@/components/text-link";
import { StayPhoto } from "@/features/catalog/components/stay-photo";

const steps = [
  [
    "01",
    "Send a request",
    "Choose your dates and rooms, review the full price, and send it to the owner.",
  ],
  [
    "02",
    "Owner responds within 12 hours",
    "Your request is Pending confirmation until the owner accepts. No room is held before then.",
  ],
  [
    "03",
    "Pay at the property",
    "Nothing is paid online. You pay the property directly when you stay.",
  ],
] as const;

const ownerPoints = [
  [Mail, "Verified email sign-in"],
  [FileText, "Private draft until review"],
  [Settings, "Manage rooms, prices and requests"],
] as const;

async function featuredStays() {
  try {
    const result = await publicPage(async () =>
      browseStays((await runtime()).env.DB, { q: "", province: "", cursor: "" }),
    );
    return { stays: result?.items.slice(0, 3) ?? [], failed: false };
  } catch {
    return { stays: [], failed: true };
  }
}

export default async function Home() {
  const { readOnly, fixtureTest } = await runtime();
  const { stays, failed } = await featuredStays();
  return (
    <PageContainer className="space-y-16">
      <section aria-labelledby="home-title" className="max-w-3xl">
        <p lang="km" className="mb-4 text-lg text-muted-foreground">
          ការកក់កន្លែងស្នាក់នៅ
        </p>
        <PageTitle id="home-title" size="hero">
          Find a place to stay in Cambodia.
          <br />
          <span className="text-primary">Request directly from the owner.</span>
        </PageTitle>
        <p className="mt-5 max-w-xl text-lg text-muted-foreground">
          {readOnly
            ? "Browse this preview. Account access and bookings are unavailable while email is disconnected."
            : "Explore stays from participating owners across the provinces. Send a request, get an answer within 12 hours, and pay at the property."}
        </p>
        <Card className="mt-8">
          <CardContent>
            <form
              action="/stays"
              method="get"
              className="grid items-end gap-4 sm:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_auto]"
            >
              <div className="min-w-0 space-y-2">
                <Label htmlFor="home-search">Property name</Label>
                <Input
                  id="home-search"
                  name="q"
                  maxLength={100}
                  placeholder="Search in Khmer or English"
                />
              </div>
              <div className="min-w-0 space-y-2">
                <Label htmlFor="home-province">Province</Label>
                <Input
                  id="home-province"
                  name="province"
                  maxLength={100}
                  placeholder="For example, Kampot"
                />
              </div>
              <Button type="submit" size="lg">
                Search stays
              </Button>
            </form>
          </CardContent>
        </Card>
        <TextLink href="/stays" className="mt-5 inline-block text-sm">
          Explore all stays →
        </TextLink>
      </section>

      <section aria-labelledby="home-stays" className="space-y-6">
        <SectionTitle id="home-stays">Stays to explore</SectionTitle>
        {stays.length === 0 ? (
          <EmptyState
            icon={<House className="size-6" />}
            title={failed ? "Stays are unavailable right now" : "No stays yet"}
            description={
              failed
                ? "Try again in a moment."
                : "New stays appear here after publication review."
            }
          >
            <TextLink href="/stays">Explore stays</TextLink>
          </EmptyState>
        ) : (
          <>
            <ul className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
              {stays.map((stay, index) => (
                <li key={stay.id} className="min-w-0">
                  <Link href={`/stays/${stay.id}`} className="block">
                    <StayPhoto
                      src={
                        stay.cover
                          ? `/api/stays/${stay.id}/photos/${stay.cover.id}`
                          : undefined
                      }
                      alt={`Cover photo of ${stay.nameEn || stay.nameKm}`}
                      eager={index === 0}
                    />
                    <div className="mt-3 space-y-1 wrap-break-word">
                      <p className="text-sm text-primary">{stay.province}</p>
                      <SectionTitle as="h3" lang="km">
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
            <div className="flex sm:justify-end">
              <Link
                href="/stays"
                className={buttonVariants({
                  variant: "outline",
                  className: "w-full sm:w-auto",
                })}
              >
                More stays →
              </Link>
            </div>
          </>
        )}
      </section>

      <section aria-labelledby="home-how" className="space-y-6">
        <SectionTitle id="home-how">How a booking request works</SectionTitle>
        <ol className="grid gap-6 md:grid-cols-3 md:gap-0 md:divide-x">
          {steps.map(([n, title, copy]) => (
            <li key={n} className="flex gap-4 md:px-6 md:first:pl-0 md:last:pr-0">
              <Badge aria-hidden="true" className="size-10 shrink-0 justify-center">
                {n}
              </Badge>
              <div>
                <SectionTitle as="h3" size="sm">
                  {title}
                </SectionTitle>
                <p className="mt-1 text-sm text-muted-foreground">{copy}</p>
              </div>
            </li>
          ))}
        </ol>
        <p className="border-t pt-6 text-center text-sm text-muted-foreground">
          $0 collected by this platform <span className="mx-2">·</span> Pay at
          the property
        </p>
      </section>

      {!readOnly && (
        <section
          aria-labelledby="home-owners"
          className="space-y-8 rounded-xl bg-secondary p-6 text-secondary-foreground sm:p-8"
        >
          <div className="grid gap-6 md:grid-cols-[minmax(0,1fr)_auto] md:items-center">
            <div className="max-w-xl">
              <p className="text-sm font-medium text-primary">
                For property owners
              </p>
              <SectionTitle id="home-owners" className="mt-1">
                List your property
              </SectionTitle>
              <p className="mt-2 text-sm text-muted-foreground">
                Set up your property privately, save it as a draft, and submit
                it for publication review when you are ready.
              </p>
            </div>
            <div className="flex flex-col gap-3 md:w-64">
              <Link
                href="/owner"
                className={buttonVariants({ size: "lg" })}
              >
                Open owner workspace →
              </Link>
              {fixtureTest ? (
                <Link
                  href="/testing"
                  className={buttonVariants({ variant: "outline", size: "lg" })}
                >
                  Start testing
                </Link>
              ) : (
                <Link
                  href="/sign-up"
                  className={buttonVariants({ variant: "outline", size: "lg" })}
                >
                  Create an account
                </Link>
              )}
            </div>
          </div>
          <ul className="flex flex-col gap-3 text-sm sm:flex-row sm:flex-wrap sm:gap-x-8">
            {ownerPoints.map(([Icon, label]) => (
              <li key={label} className="flex items-center gap-2">
                <Icon aria-hidden="true" className="size-5 text-primary" />
                {label}
              </li>
            ))}
          </ul>
        </section>
      )}
    </PageContainer>
  );
}
