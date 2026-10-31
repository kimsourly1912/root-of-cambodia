import * as React from "react";

import { cn } from "@/lib/utils";

const Checkbox = React.forwardRef<
  HTMLInputElement,
  Omit<React.ComponentProps<"input">, "type">
>(({ className, ...props }, ref) => (
  <input
    type="checkbox"
    ref={ref}
    className={cn(
      "mt-1 size-4 shrink-0 rounded-sm border border-input accent-primary focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50",
      className,
    )}
    {...props}
  />
));
Checkbox.displayName = "Checkbox";

function CheckboxField({
  children,
  className,
  ...props
}: Omit<React.ComponentProps<"input">, "type"> & { children: React.ReactNode }) {
  return (
    <label className={cn("flex min-h-11 items-start gap-3 py-2 text-sm", className)}>
      <Checkbox {...props} />
      <span>{children}</span>
    </label>
  );
}

export { Checkbox, CheckboxField };
