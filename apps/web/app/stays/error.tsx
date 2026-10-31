"use client";
import { Button } from "@/components/ui/button";
import { PageTitle } from "@/components/typography";
export default function ErrorPage({ reset }: { reset: () => void }) {
  return (
    <div className="py-16">
      <PageTitle>
        Stays are temporarily unavailable
      </PageTitle>
      <p className="my-5 text-muted-foreground">Please try again.</p>
      <Button onClick={reset}>Try again</Button>
    </div>
  );
}
