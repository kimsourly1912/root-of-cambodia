import * as React from "react";

import { cn } from "@/lib/utils";

// A styled native checkbox rather than shadcn's Radix button: native `required`,
// `defaultChecked`, form submission and server-rendered `disabled` behave exactly
// as before, which the hydration-gated confirmation flows rely on.
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

// Checkbox with its visible text, so the whole row is the click target.
function CheckboxField({
  children,
  className,
  ...props
}: Omit<React.ComponentProps<"input">, "type"> & { children: React.ReactNode }) {
  return (
    <label className={cn("flex items-start gap-3 text-sm", className)}>
      <Checkbox {...props} />
      <span>{children}</span>
    </label>
  );
}

export { Checkbox, CheckboxField };
