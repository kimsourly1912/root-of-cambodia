import * as React from "react";
import { IntentLink } from "@/components/intent-link";

import { cn } from "@/lib/utils";

// In-text and standalone navigation links. Use buttonVariants for links that
// look like buttons. className is for layout, not color or decoration.
const textLinkClass =
  "font-medium text-primary underline underline-offset-4 hover:text-primary/80";

function TextLink({ className, ...props }: React.ComponentProps<typeof IntentLink>) {
  return <IntentLink className={cn(textLinkClass, className)} {...props} />;
}

// For a native <a> that must force a full page load (for example recovery
// links): <a className={cn(textLinkClass, "block")} href=…>.
export { TextLink, textLinkClass };
