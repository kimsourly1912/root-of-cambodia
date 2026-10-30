"use client";
import { Button } from "@/components/ui/button";
export default function ErrorPage({ reset }: { reset: () => void }) {
  return (
    <section className="space-y-5">
      <h1 className="text-2xl font-semibold">
        Bookings temporarily unavailable
      </h1>
      <p>
        We couldn’t load this page. Reload to check the current result before
        starting another request.
      </p>
      <Button onClick={reset}>Try again</Button>
    </section>
  );
}
