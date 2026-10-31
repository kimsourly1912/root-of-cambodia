import * as React from "react";
import Link from "next/link";

import { cn } from "@/lib/utils";

// In-text and standalone navigation links. Use <Button asChild><Link/></Button>
// for links that look like buttons. className is for layout (block, margins),
// not for color or decoration.
const textLinkClass =
  "font-medium text-primary underline underline-offset-4 hover:text-primary/80";

function TextLink({ className, ...props }: React.ComponentProps<typeof Link>) {
  return <Link className={cn(textLinkClass, className)} {...props} />;
}

// For a native <a> that must force a full page load (for example recovery
// links): <a className={cn(textLinkClass, "block")} href=…>.
export { TextLink, textLinkClass };
