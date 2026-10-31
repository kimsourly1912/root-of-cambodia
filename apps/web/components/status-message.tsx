import * as React from "react";

import { cn } from "@/lib/utils";

const tones = {
  // A problem with the user's last action: announced immediately.
  error: { role: "alert", className: "text-sm text-destructive" },
  // A completed action.
  success: { role: "status", className: "text-sm font-medium text-primary" },
  // Neutral progress or information.
  info: { role: "status", className: "text-sm text-muted-foreground" },
} as const;

// One-line feedback next to the control or form it belongs to. For a boxed,
// multi-line notice use Alert from components/ui/alert.
function StatusMessage({
  tone,
  className,
  ...props
}: React.HTMLAttributes<HTMLParagraphElement> & { tone: keyof typeof tones }) {
  const { role, className: toneClass } = tones[tone];
  return <p role={role} className={cn(toneClass, className)} {...props} />;
}

// Route-level loading.tsx content. `label` is announced; `children` is an
// optional skeleton of the page (decorative, hidden from assistive technology).
// Without children the label is shown as text.
function LoadingState({
  label,
  children,
  className,
}: {
  label: string;
  children?: React.ReactNode;
  className?: string;
}) {
  if (!children)
    return (
      <p role="status" className={cn("py-12 text-muted-foreground", className)}>
        {label}
      </p>
    );
  return (
    <div role="status" className={className}>
      <span className="sr-only">{label}</span>
      <div aria-hidden="true">{children}</div>
    </div>
  );
}

export { StatusMessage, LoadingState };
