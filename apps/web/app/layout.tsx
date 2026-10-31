import type { ReactNode } from "react";
import { runtime } from "@/server/runtime";
import "./globals.css";

export const dynamic = "force-dynamic";
export async function generateMetadata() {
  const { isStaging } = await runtime();
  return {
    title: { default: "Root of Cambodia", template: "%s · Root of Cambodia" },
    description: "Explore accommodation in Cambodia and manage your property.",
    ...(isStaging ? { robots: { index: false, follow: false } } : {}),
  };
}
// Public pages use app/(site)/layout.tsx; owner and reviewer pages use
// app/(workspace)/layout.tsx. URLs are unchanged by these route groups.
export default function Layout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body>
        <a
          href="#main"
          className="sr-only focus:not-sr-only focus:absolute focus:z-50 focus:bg-card focus:p-3 focus:text-foreground"
        >
          Skip to content
        </a>
        {children}
      </body>
    </html>
  );
}
