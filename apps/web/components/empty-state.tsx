import * as React from "react";

import { SectionTitle } from "@/components/typography";
import { cn } from "@/lib/utils";

// Shown when a list or area has nothing yet. Keep the title's real heading
// level with `titleAs`; put the next step (a Button or TextLink) in children.
function EmptyState({
  icon,
  title,
  titleAs,
  description,
  children,
  className,
}: {
  icon?: React.ReactNode;
  title?: React.ReactNode;
  titleAs?: "h2" | "h3";
  description?: React.ReactNode;
  children?: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("rounded-xl border border-dashed p-10 text-center", className)}>
      {icon && (
        <span
          className="mb-5 inline-flex size-14 items-center justify-center rounded-full bg-secondary text-2xl text-primary"
          aria-hidden="true"
        >
          {icon}
        </span>
      )}
      {title && <SectionTitle as={titleAs}>{title}</SectionTitle>}
      {description && (
        <p className={cn("mx-auto max-w-md text-sm text-muted-foreground", title && "mt-3")}>
          {description}
        </p>
      )}
      {children && <div className="mt-6 flex flex-wrap justify-center gap-4">{children}</div>}
    </div>
  );
}

export { EmptyState };
