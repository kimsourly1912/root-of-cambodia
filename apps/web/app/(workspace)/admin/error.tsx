"use client";

import { Button } from "@/components/ui/button";
import { PageTitle } from "@/components/typography";
export default function ErrorPage({ reset }: { reset: () => void }) {
  return (
    <div className="space-y-5 py-12">
      <PageTitle>We couldn’t load this admin page</PageTitle>
      <p className="text-muted-foreground">Please try again shortly. No decision was made by loading this page.</p>
      <Button onClick={reset}>Try again</Button>
    </div>
  );
}
