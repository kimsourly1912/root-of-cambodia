"use client";
import { Button } from "@/components/ui/button";
export default function ErrorPage({ reset }: { reset: () => void }) {
  return (
    <div className="py-16">
      <h1 className="text-3xl font-semibold">
        Stays are temporarily unavailable
      </h1>
      <p className="my-5 text-muted-foreground">Please try again.</p>
      <Button onClick={reset}>Try again</Button>
    </div>
  );
}
