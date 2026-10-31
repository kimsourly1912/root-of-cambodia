"use client";
import { useLinkStatus } from "next/link";

// Place inside a positioned (`relative`) <Link> in a navigation bar: a bar
// under the link appears while its page loads. It waits briefly so fast
// navigations do not flash, and is decorative; the destination's loading.tsx
// announces progress to assistive technology.
function LinkPending() {
  const { pending } = useLinkStatus();
  return (
    <span
      aria-hidden="true"
      className={
        "pointer-events-none absolute inset-x-0 bottom-0 h-0.5 rounded-full bg-primary transition-opacity " +
        (pending ? "opacity-100 delay-150" : "opacity-0")
      }
    />
  );
}

export { LinkPending };
