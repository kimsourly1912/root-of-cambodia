"use client";
import { Button } from "@/components/ui/button";
export default function ErrorPage({ reset }: { reset: () => void }) {
  return (
    <div className="space-y-5 py-12">
      <h1 className="text-2xl font-semibold">
        We couldn’t load your workspace
      </h1>
      <p className="text-muted-foreground">
        Please try again shortly. Your saved details are held in your account.
      </p>
      <Button onClick={reset}>Try again</Button>
    </div>
  );
}
