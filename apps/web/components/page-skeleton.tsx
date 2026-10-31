import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";

import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

// Placeholders for loading.tsx skeletons, sized to the real content so the page
// does not jump when it arrives. Render them inside LoadingState, which hides
// them from assistive technology. `className` sets width and margins only.

// One line of text: the row takes the text's line height, the bar sits inside.
const skeletonLineVariants = cva("flex items-center *:w-full", {
  variants: {
    size: {
      xs: "h-4 *:h-3", // text-xs
      label: "h-3.5 *:h-3", // Label (text-sm, leading-none)
      sm: "h-5 *:h-3.5", // text-sm
      base: "h-6 *:h-4", // text-base, CardTitle, SectionTitle size="sm"
      lg: "h-7 *:h-5", // text-lg, SectionTitle
      "2xl": "h-8 *:h-6",
      title: "h-9 *:h-7", // PageTitle
      display: "h-9 *:h-7 sm:h-10 sm:*:h-8", // the stay name
      hero: "h-10 *:h-8 sm:h-12 sm:*:h-10", // PageTitle size="hero"
    },
  },
  defaultVariants: { size: "base" },
});

function SkeletonLine({
  size,
  className,
}: VariantProps<typeof skeletonLineVariants> & { className?: string }) {
  return (
    <div className={cn(skeletonLineVariants({ size }), className)}>
      <Skeleton />
    </div>
  );
}

// A wrapping paragraph: full lines and a shorter last line.
function SkeletonParagraph({
  lines = 2,
  size,
  className,
}: VariantProps<typeof skeletonLineVariants> & { lines?: number; className?: string }) {
  return (
    <div className={className}>
      {Array.from({ length: lines }, (_, index) => (
        <SkeletonLine key={index} size={size} className={index === lines - 1 ? "w-2/3" : undefined} />
      ))}
    </div>
  );
}

// Matches Button size="default" (and size="sm"), including the touch height.
function SkeletonButton({ size = "default", className }: { size?: "default" | "sm"; className?: string }) {
  return (
    <Skeleton
      className={cn(
        "shrink-0 rounded-lg [@media(pointer:coarse)]:min-h-11",
        size === "sm" ? "h-7 w-20" : "h-8 w-28",
        className,
      )}
    />
  );
}

function SkeletonBadge({ className }: { className?: string }) {
  return <Skeleton className={cn("h-5 w-16 rounded-4xl", className)} />;
}

// A Label above an Input (or Textarea) as the forms lay them out.
function SkeletonField({ textarea = false, className }: { textarea?: boolean; className?: string }) {
  return (
    <div className={cn("min-w-0 space-y-2", className)}>
      <SkeletonLine size="label" className="w-24" />
      <Skeleton
        className={cn("w-full rounded-lg", textarea ? "h-40" : "h-8 [@media(pointer:coarse)]:min-h-11")}
      />
    </div>
  );
}

// A Card with a title, an optional description and its body.
function SkeletonCard({
  description = true,
  children,
  className,
}: {
  description?: boolean;
  children?: React.ReactNode;
  className?: string;
}) {
  return (
    <Card className={className}>
      <CardHeader>
        <SkeletonLine className="w-40" />
        {description && <SkeletonLine size="sm" className="w-64 max-w-full" />}
      </CardHeader>
      {children && <CardContent className="space-y-5">{children}</CardContent>}
    </Card>
  );
}

// The owner forms' layout: cards of fields and a sticky save panel. Each row
// is one field, two side by side, three side by side, or a text area.
type SkeletonFieldRow = "input" | "pair" | "triple" | "textarea";
function SkeletonFormLayout({ cards }: { cards: SkeletonFieldRow[][] }) {
  return (
    <div className="grid items-start gap-8 lg:grid-cols-[minmax(0,1fr)_280px]">
      <div className="space-y-6">
        {cards.map((rows, card) => (
          <SkeletonCard key={card}>
            {rows.map((row, index) =>
              row === "pair" || row === "triple" ? (
                <div key={index} className={cn("grid gap-5", row === "pair" ? "sm:grid-cols-2" : "sm:grid-cols-3")}>
                  {Array.from({ length: row === "pair" ? 2 : 3 }, (_, field) => (
                    <SkeletonField key={field} />
                  ))}
                </div>
              ) : (
                <SkeletonField key={index} textarea={row === "textarea"} />
              ),
            )}
          </SkeletonCard>
        ))}
      </div>
      <SkeletonAsidePanel />
    </div>
  );
}

// The sticky panel beside a form or review: status, a note and the action.
function SkeletonAsidePanel() {
  return (
    <div className="space-y-5 lg:sticky lg:top-8">
      <Card>
        <CardHeader>
          <SkeletonBadge className="mb-2" />
          <SkeletonLine className="w-32" />
          <SkeletonParagraph size="sm" />
        </CardHeader>
        <CardContent className="space-y-4">
          <SkeletonParagraph size="xs" />
          <SkeletonButton className="w-full" />
        </CardContent>
      </Card>
    </div>
  );
}

export {
  SkeletonLine,
  SkeletonParagraph,
  SkeletonButton,
  SkeletonBadge,
  SkeletonField,
  SkeletonCard,
  SkeletonFormLayout,
  SkeletonAsidePanel,
};
