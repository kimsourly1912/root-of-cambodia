"use client";
import { Button } from "@/components/ui/button";
import { PageTitle } from "@/components/typography";
export default function ErrorPage({ reset }: { reset: () => void }) {
  return (
    <section className="space-y-5">
      <PageTitle>
        Bookings temporarily unavailable
      </PageTitle>
      <p>
        We couldn’t load this page. Reload to check the current result before
        starting another request.
      </p>
      <Button onClick={reset}>Try again</Button>
    </section>
  );
}
