import * as React from "react";

import { cn } from "@/lib/utils";

// Native <details>: works before hydration and without JavaScript.
// "card" frames a large section; "plain" is an inline "show more".
function Disclosure({
  summary,
  variant = "card",
  className,
  children,
  ...props
}: Omit<React.DetailsHTMLAttributes<HTMLDetailsElement>, "summary"> & {
  summary: React.ReactNode;
  variant?: "card" | "plain";
}) {
  return (
    <details
      className={cn(variant === "card" && "rounded-xl border bg-card p-5", className)}
      {...props}
    >
      <summary
        className={cn(
          "cursor-pointer font-semibold",
          variant === "card" ? "mb-5 text-lg" : "font-medium",
        )}
      >
        {summary}
      </summary>
      {children}
    </details>
  );
}

export { Disclosure };
