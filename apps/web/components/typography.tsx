import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@/lib/utils";

// One h1 per page. "hero" is reserved for the public landing page.
const pageTitleVariants = cva("break-words font-semibold tracking-tight", {
  variants: {
    size: {
      default: "text-3xl",
      hero: "text-4xl sm:text-5xl",
    },
  },
  defaultVariants: { size: "default" },
});

function PageTitle({
  className,
  size,
  ...props
}: React.HTMLAttributes<HTMLHeadingElement> & VariantProps<typeof pageTitleVariants>) {
  return <h1 className={cn(pageTitleVariants({ size }), className)} {...props} />;
}

// Section headings below the page title. Keep the real heading level with `as`;
// `size` only changes how prominent it looks.
const sectionTitleVariants = cva("break-words font-semibold", {
  variants: {
    size: {
      default: "text-xl",
      sm: "text-base",
    },
  },
  defaultVariants: { size: "default" },
});

function SectionTitle({
  as: Tag = "h2",
  className,
  size,
  ...props
}: React.HTMLAttributes<HTMLHeadingElement> &
  VariantProps<typeof sectionTitleVariants> & { as?: "h2" | "h3" | "h4" }) {
  return <Tag className={cn(sectionTitleVariants({ size }), className)} {...props} />;
}

export { PageTitle, SectionTitle };
