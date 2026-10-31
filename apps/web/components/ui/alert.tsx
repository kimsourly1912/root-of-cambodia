import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@/lib/utils";

// Block-level notice. Pass role="alert" for problems the user must notice now,
// role="status" for confirmations or neutral information.
const alertVariants = cva("space-y-3 rounded-lg border p-4 text-sm", {
  variants: {
    variant: {
      default: "bg-card text-foreground",
      info: "border-transparent bg-secondary text-secondary-foreground",
      destructive: "border-destructive/40 text-destructive",
    },
  },
  defaultVariants: {
    variant: "default",
  },
});

const Alert = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement> & VariantProps<typeof alertVariants>
>(({ className, variant, ...props }, ref) => (
  <div ref={ref} className={cn(alertVariants({ variant }), className)} {...props} />
));
Alert.displayName = "Alert";

const AlertTitle = React.forwardRef<
  HTMLParagraphElement,
  React.HTMLAttributes<HTMLParagraphElement>
>(({ className, ...props }, ref) => (
  <p ref={ref} className={cn("font-medium", className)} {...props} />
));
AlertTitle.displayName = "AlertTitle";

export { Alert, AlertTitle, alertVariants };
