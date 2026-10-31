"use client";
import { Button } from "@/components/ui/button";
import { PageTitle } from "@/components/typography";
export default function ErrorPage({ reset }: { reset: () => void }) {
  return (
    <div className="space-y-5 py-12">
      <PageTitle>
        We couldn’t load your workspace
      </PageTitle>
      <p className="text-muted-foreground">
        Please try again shortly. Your saved details are held in your account.
      </p>
      <Button onClick={reset}>Try again</Button>
    </div>
  );
}
