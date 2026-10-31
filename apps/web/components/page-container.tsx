import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@/lib/utils";

// The page's <main> landmark. Area layouts (owner, bookings, review, stays)
// render it once; standalone pages render it themselves.
const pageContainerVariants = cva("mx-auto px-5 sm:px-8", {
  variants: {
    variant: {
      // Workspaces and browsing: wide content.
      default: "max-w-6xl py-8",
      // Single-task pages such as sign-in: the form sets its own width.
      focused: "max-w-6xl py-12 sm:py-16",
      // The public landing page.
      landing: "max-w-6xl py-16 sm:py-24",
    },
  },
  defaultVariants: { variant: "default" },
});

function PageContainer({
  className,
  variant,
  ...props
}: React.HTMLAttributes<HTMLElement> & VariantProps<typeof pageContainerVariants>) {
  return (
    <main id="main" className={cn(pageContainerVariants({ variant }), className)} {...props} />
  );
}

export { PageContainer };
