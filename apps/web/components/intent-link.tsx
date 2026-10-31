"use client";
import * as React from "react";
import Link from "next/link";

// A <Link> that prefetches only the loading shell while visible (the default)
// and the whole page once the user shows intent (hover, focus or touch), so a
// click usually renders at once without every visible link costing a server
// render. The client cache (staleTimes in next.config.ts) keeps it for 30s.
function IntentLink({
  prefetch,
  onMouseEnter,
  onTouchStart,
  onFocus,
  ...props
}: React.ComponentProps<typeof Link>) {
  const [intent, setIntent] = React.useState(false);
  return (
    <Link
      {...props}
      prefetch={prefetch === false ? false : intent || prefetch}
      onMouseEnter={(event) => {
        setIntent(true);
        onMouseEnter?.(event);
      }}
      onTouchStart={(event) => {
        setIntent(true);
        onTouchStart?.(event);
      }}
      onFocus={(event) => {
        setIntent(true);
        onFocus?.(event);
      }}
    />
  );
}

export { IntentLink };
